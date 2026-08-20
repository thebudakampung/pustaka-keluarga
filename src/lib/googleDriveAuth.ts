import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { compressImageBase64 } from '../utils/imageOptimizer';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.readonly');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

declare global {
  interface Window {
    google?: any;
  }
}

export const requestGsiDriveToken = async (): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services client belum dimuatkan. Sila semak sambungan internet.'));
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.oAuthClientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
          } else if (response.access_token) {
            cachedAccessToken = response.access_token;
            resolve(response.access_token);
          } else {
            reject(new Error('Gagal mendapatkan token akses Google Drive.'));
          }
        },
        error_callback: (err: any) => {
          reject(err);
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (e: any) {
      reject(e);
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User | null; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses daripada Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';
    const errorMsg = error?.message || String(error);

    // If user voluntarily closes or cancels the popup, treat as gentle cancellation (no error throw)
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorMsg.includes('popup-closed-by-user') ||
      errorMsg.includes('cancelled-popup-request')
    ) {
      console.info('Log masuk Google dibatalkan oleh pengguna (tetingkap ditutup).');
      return null;
    }

    // If unauthorized-domain occurs, try GSI Token Client directly as seamless fallback!
    if (errorCode === 'auth/unauthorized-domain' || errorMsg.includes('unauthorized-domain')) {
      console.warn('Firebase Auth unauthorized-domain dikesan. Mencuba Google Identity Services (GSI)...');
      try {
        const token = await requestGsiDriveToken();
        if (token) {
          return { user: auth.currentUser || null, accessToken: token };
        }
      } catch (gsiErr: any) {
        console.warn('GSI fallback juga gagal atau memerlukan konfigurasi:', gsiErr);
      }

      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const customErr: any = new Error(
        `Domain aplikasi (${currentHost}) belum didaftarkan dalam senarai domain dibenarkan (Authorized Domains) di konsol Firebase Auth.`
      );
      customErr.code = 'auth/unauthorized-domain';
      customErr.domain = currentHost;
      customErr.projectId = firebaseConfig.projectId;
      throw customErr;
    }

    if (errorCode === 'auth/popup-blocked' || errorMsg.includes('popup-blocked')) {
      throw new Error('Tetingkap log masuk disekat oleh pelayar web (popup blocker). Sila benarkan tetingkap timbul dan cuba lagi.');
    }

    if (errorCode === 'auth/network-request-failed' || errorMsg.includes('network-request-failed')) {
      throw new Error('Ralat sambungan rangkaian semasa menghubungi pelayan Google. Sila semak sambungan internet anda.');
    }

    console.warn('Ralat pengesahan Google Drive:', errorMsg);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const tokenResult = await currentUser.getIdTokenResult();
      // Note: Google OAuth access token for APIs requires GoogleAuthProvider credential.
      // If cachedAccessToken is null but user is signed in, prompt sign in or refresh.
    } catch (e) {
      console.error(e);
    }
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface DriveImageFile {
  id: string;
  name: string;
  mimeType: string;
  isFolder?: boolean;
  thumbnailLink?: string;
  webContentLink?: string;
  size?: string;
  modifiedTime?: string;
}

export interface DriveFolderBreadcrumb {
  id: string;
  name: string;
}

export const fetchDriveItems = async (
  accessToken: string,
  folderId: string = 'root',
  searchQuery: string = '',
  viewMode: 'folder' | 'all-images' = 'folder'
): Promise<{ folders: DriveImageFile[]; images: DriveImageFile[] }> => {
  let query = '';

  if (searchQuery.trim()) {
    const escapedSearch = searchQuery.trim().replace(/'/g, "\\'");
    query = encodeURIComponent(
      `trashed = false and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'image/') and name contains '${escapedSearch}'`
    );
  } else if (viewMode === 'all-images') {
    query = encodeURIComponent("mimeType contains 'image/' and trashed = false");
  } else {
    // Current folder items: both subfolders and image files
    query = encodeURIComponent(
      `'${folderId}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'image/')`
    );
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=100&orderBy=folder,name&fields=files(id,name,mimeType,thumbnailLink,webContentLink,size,modifiedTime)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    let errJson: any = null;
    let errText = '';
    try {
      errJson = await res.json();
    } catch {
      errText = await res.text();
    }

    const message = errJson?.error?.message || errText;
    if (
      res.status === 403 &&
      (message.includes('SERVICE_DISABLED') ||
        message.includes('Google Drive API has not been used') ||
        message.includes('drive.googleapis.com') ||
        message.includes('accessNotConfigured'))
    ) {
      const activationUrl =
        errJson?.error?.details?.[0]?.metadata?.activationUrl ||
        errJson?.error?.details?.[2]?.links?.[0]?.url ||
        `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${firebaseConfig.projectId}`;

      const error: any = new Error(
        'Google Drive API belum diaktifkan dalam projek Google Cloud anda. Sila aktifkan servis ini di konsol Google Cloud.'
      );
      error.code = 'DRIVE_API_DISABLED';
      error.activationUrl = activationUrl;
      throw error;
    }

    throw new Error(`Gagal memuat fail/folder Google Drive (${res.status}): ${message}`);
  }

  const data = await res.json();
  const allFiles: DriveImageFile[] = (data.files || []).map((f: any) => ({
    ...f,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }));

  const folders = allFiles.filter((f) => f.isFolder);
  const images = allFiles.filter((f) => !f.isFolder);

  return { folders, images };
};

export const fetchDriveImages = async (accessToken: string): Promise<DriveImageFile[]> => {
  const { images } = await fetchDriveItems(accessToken, 'root', '', 'all-images');
  return images;
};

export const downloadDriveImageAsBase64 = async (fileId: string, accessToken: string): Promise<string> => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Gagal memuat turun fail imej dari Drive (${res.status})`);
  }

  const blob = await res.blob();
  const rawBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal menukar fail kepada base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return await compressImageBase64(rawBase64, 800, 800, 0.72);
};
