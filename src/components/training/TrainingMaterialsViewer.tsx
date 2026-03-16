import React, { useState, useEffect } from 'react';
import { FileText, Video, Download, Loader2, Search, File } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface TrainingMaterial {
  id: string;
  title: string;
  fileUrl: string;
  type: 'pdf' | 'video' | 'other';
  uploadedBy: string;
  createdAt: Timestamp | null;
  fileName?: string;
  fileSize?: number;
}

const formatBytes = (bytes?: number) => {
  if (bytes === undefined || bytes === null) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (ts: Timestamp | null) => {
  if (!ts) return '';
  try {
    const d = typeof (ts as any).toDate === 'function' ? (ts as any).toDate() : new Date(ts as any);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

const typeIcon = (type: string) => {
  if (type === 'pdf') return <FileText className="w-10 h-10 text-red-500" />;
  if (type === 'video') return <Video className="w-10 h-10 text-blue-500" />;
  return <File className="w-10 h-10 text-gray-400" />;
};

const typeBadge = (type: string) => {
  if (type === 'pdf') return 'bg-red-100 text-red-700';
  if (type === 'video') return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-700';
};

const TrainingMaterialsViewer: React.FC = () => {
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'training_materials'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMaterials(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingMaterial)));
        setLoading(false);
      },
      () => {
        // Fallback without ordering
        const q2 = query(collection(db, 'training_materials'));
        onSnapshot(q2, (snap2) => {
          setMaterials(snap2.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingMaterial)));
          setLoading(false);
        });
      }
    );
    return () => unsub();
  }, []);

  const filtered = search.trim()
    ? materials.filter(
        (m) =>
          m.title.toLowerCase().includes(search.toLowerCase()) ||
          (m.type || '').toLowerCase().includes(search.toLowerCase())
      )
    : materials;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
        <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <h4 className="font-semibold text-gray-900 mb-1">No Training Materials Yet</h4>
        <p className="text-sm text-gray-500">Training materials uploaded by your admin will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-gray-900">Training Materials</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials…"
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white w-52"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m) => (
          <div
            key={m.id}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0">{typeIcon(m.type)}</div>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-gray-900 text-sm leading-tight truncate">{m.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeBadge(m.type)}`}>
                    {(m.type || 'file').toUpperCase()}
                  </span>
                  {m.fileSize && (
                    <span className="text-xs text-gray-400">{formatBytes(m.fileSize)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500 space-y-1 mb-4 flex-1">
              {m.uploadedBy && <p>Uploaded by: {m.uploadedBy}</p>}
              {m.createdAt && <p>{formatDate(m.createdAt)}</p>}
            </div>

            <a
              href={m.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              {m.type === 'video' ? 'Watch Video' : 'View / Download'}
            </a>
          </div>
        ))}
      </div>

      {search && filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No materials matching "{search}"
        </div>
      )}
    </div>
  );
};

export default TrainingMaterialsViewer;
