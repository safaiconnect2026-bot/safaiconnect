import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Video, Download, Loader2, Trash2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { uploadToCloudinary, deleteFromCloudinary } from '../../../lib/cloudinary';
import { User } from '../../../App';
import { useToast } from '../../../contexts/ToastContext';

interface TrainingMaterial {
  id: string;
  title: string;
  fileUrl: string;
  type: 'pdf' | 'video' | 'other';
  uploadedBy: string;
  createdAt: Timestamp | null;
  fileName?: string;
  fileSize?: number;
  storagePath?: string;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

interface TrainingUploadTabProps {
  user: User;
}

const TrainingUploadTab: React.FC<TrainingUploadTabProps> = ({ user }) => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'training_materials'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMaterials(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingMaterial)));
      setLoadingMaterials(false);
    }, () => {
      setLoadingMaterials(false);
      toastError('Failed to load training materials.');
    });
    return () => unsub();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toastError('File too large. Maximum size is 50 MB.');
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  const detectType = (file: File): 'pdf' | 'video' | 'other' => {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('video/')) return 'video';
    return 'other';
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title.trim()) {
      toastError('Please select a file and enter a title.');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const fileType = detectType(selectedFile);

      const result = await uploadToCloudinary(selectedFile, {
        folder: 'training-materials',
        onProgress: (percent) => setUploadProgress(percent),
      });

      await addDoc(collection(db, 'training_materials'), {
        title: title.trim(),
        fileUrl: result.secure_url,
        type: fileType,
        uploadedBy: user.name || user.email,
        uploadedById: user.id,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        cloudinaryPublicId: result.public_id,
        createdAt: serverTimestamp(),
      });

      toastSuccess('Training material uploaded successfully!');
      setTitle('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Upload error:', err);
      toastError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (material: TrainingMaterial) => {
    try {
      if ((material as any).cloudinaryPublicId) {
        await deleteFromCloudinary((material as any).cloudinaryPublicId);
      }
      await deleteDoc(doc(db, 'training_materials', material.id));
      toastSuccess('Material deleted.');
    } catch (err: any) {
      toastError(err?.message || 'Failed to delete.');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Training Materials</h2>
        <p className="text-gray-600">Upload PDF documents and videos for worker training</p>
      </div>

      {/* Upload Form */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Upload className="w-5 h-5 text-emerald-600" />
          Upload New Material
        </h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Waste Segregation Guide"
              className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              File (PDF or Video, max 50 MB)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,video/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              required
            />
            {selectedFile && (
              <p className="text-xs text-gray-500 mt-1">
                Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
              </p>
            )}
          </div>
          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {uploading ? 'Uploading…' : 'Upload Material'}
          </button>
        </form>
      </div>

      {/* Uploaded Materials List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Uploaded Materials ({materials.length})</h3>
        </div>
        {loadingMaterials ? (
          <div className="flex justify-center p-10">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : materials.length === 0 ? (
          <div className="text-center p-10 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No materials uploaded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {materials.map((m) => (
              <div key={m.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {m.type === 'pdf' ? (
                    <FileText className="w-8 h-8 text-red-500 flex-shrink-0" />
                  ) : m.type === 'video' ? (
                    <Video className="w-8 h-8 text-blue-500 flex-shrink-0" />
                  ) : (
                    <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{m.title}</p>
                    <p className="text-xs text-gray-500">
                      {m.type?.toUpperCase()} · {formatBytes(m.fileSize)} · by {m.uploadedBy}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Download / Open"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                  {confirmDeleteId === m.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(m)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                      >
                        Confirm?
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(m.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingUploadTab;
