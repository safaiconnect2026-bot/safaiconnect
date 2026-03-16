import React, { useEffect, useState, useMemo } from 'react';
import {
    Truck,
    Activity,
    AlertTriangle,
    Package,
    Plus,
    Pencil,
    Trash2,
    X,
    Loader2,
    CheckCircle,
    Wrench,
    Search
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import { useLanguage } from '../../../contexts/LanguageContext';
import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    query,
    orderBy,
    getDocs
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';

// ─── Types ───────────────────────────────────────────────────────────────────
type ItemType = 'vehicle' | 'equipment';
type VehicleStatus = 'active' | 'maintenance' | 'inactive';
type EquipmentStatus = 'good' | 'fair' | 'low_stock';

interface InventoryItem {
    id: string;
    type: ItemType;
    name: string;
    subtype?: string;           // vehicle type or equipment category
    status: VehicleStatus | EquipmentStatus;
    quantity: number;           // 1 for individual vehicles
    licensePlate?: string;
    notes?: string;
    value?: number;             // estimated value in ₹
    lastUpdated?: any;
}

// ─── Seed data ────────────────────────────────────────────────────────────────
const SEED_DATA: Omit<InventoryItem, 'id'>[] = [
    { type: 'vehicle', name: 'Compactor Truck #1', subtype: 'Compactor Truck', status: 'active', quantity: 1, licensePlate: 'MH-01-AB-1234', value: 2500000 },
    { type: 'vehicle', name: 'Compactor Truck #2', subtype: 'Compactor Truck', status: 'active', quantity: 1, licensePlate: 'MH-01-AB-1235', value: 2500000 },
    { type: 'vehicle', name: 'Compactor Truck #3', subtype: 'Compactor Truck', status: 'maintenance', quantity: 1, licensePlate: 'MH-01-AB-1236', value: 2500000 },
    { type: 'vehicle', name: 'Side Loader #1', subtype: 'Side Loader', status: 'active', quantity: 1, licensePlate: 'MH-01-CD-2345', value: 1800000 },
    { type: 'vehicle', name: 'Side Loader #2', subtype: 'Side Loader', status: 'active', quantity: 1, licensePlate: 'MH-01-CD-2346', value: 1800000 },
    { type: 'vehicle', name: 'Front Loader #1', subtype: 'Front Loader', status: 'active', quantity: 1, licensePlate: 'MH-01-EF-3456', value: 3200000 },
    { type: 'vehicle', name: 'Roll-off Truck #1', subtype: 'Roll-off Truck', status: 'active', quantity: 1, licensePlate: 'MH-01-GH-4567', value: 2200000 },
    { type: 'vehicle', name: 'Roll-off Truck #2', subtype: 'Roll-off Truck', status: 'maintenance', quantity: 1, licensePlate: 'MH-01-GH-4568', value: 2200000 },
    { type: 'equipment', name: 'Waste Bins (Large)', subtype: 'Waste Container', status: 'good', quantity: 450, value: 900000 },
    { type: 'equipment', name: 'Safety Equipment Sets', subtype: 'Safety Gear', status: 'good', quantity: 120, value: 360000 },
    { type: 'equipment', name: 'Collection Tools', subtype: 'Hand Tool', status: 'fair', quantity: 200, value: 100000 },
    { type: 'equipment', name: 'Cleaning Supplies (kg)', subtype: 'Consumable', status: 'low_stock', quantity: 80, value: 24000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const vehicleStatusBadge = (s: VehicleStatus) =>
    s === 'active' ? 'bg-emerald-100 text-emerald-700'
        : s === 'maintenance' ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700';

const vehicleStatusLabel = (s: VehicleStatus) =>
    s === 'active' ? 'Active' : s === 'maintenance' ? 'Maintenance' : 'Inactive';

const equipStatusBadge = (s: EquipmentStatus) =>
    s === 'good' ? 'bg-emerald-100 text-emerald-700'
        : s === 'fair' ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700';

const equipStatusLabel = (s: EquipmentStatus) =>
    s === 'good' ? 'Good' : s === 'fair' ? 'Fair' : 'Low Stock';

const formatValue = (v?: number) => {
    if (!v) return '—';
    if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)}Cr`;
    if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
    return `₹${v.toLocaleString('en-IN')}`;
};

const formatDate = (ts: any) => {
    if (!ts) return '—';
    try {
        const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return '—'; }
};

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
    item?: InventoryItem | null;
    activeTab: 'vehicle' | 'equipment';
    onClose: () => void;
    onSave: (data: Partial<InventoryItem>) => Promise<void>;
}

const ItemModal: React.FC<ModalProps> = ({ item, activeTab, onClose, onSave }) => {
    const isEdit = !!item;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        type: (item?.type ?? activeTab) as ItemType,
        name: item?.name ?? '',
        subtype: item?.subtype ?? '',
        status: item?.status ?? (activeTab === 'vehicle' ? 'active' : 'good'),
        quantity: item?.quantity ?? (activeTab === 'vehicle' ? 1 : 0),
        licensePlate: item?.licensePlate ?? '',
        notes: item?.notes ?? '',
        value: item?.value ?? 0,
    });

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await onSave({
                type: form.type,
                name: form.name.trim(),
                subtype: form.subtype.trim() || undefined,
                status: form.status as any,
                quantity: Number(form.quantity),
                licensePlate: form.licensePlate.trim() || undefined,
                notes: form.notes.trim() || undefined,
                value: Number(form.value) || undefined,
            });
            onClose();
        } catch (err: any) {
            console.error('Error saving inventory item:', err);
            setError(err.message || 'Failed to save item. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isEdit ? 'Edit Item' : `Add New ${form.type === 'vehicle' ? 'Vehicle' : 'Equipment'}`}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input
                            required
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            placeholder={form.type === 'vehicle' ? 'e.g. Compactor Truck #4' : 'e.g. Safety Helmets'}
                        />
                    </div>

                    {/* Subtype */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {form.type === 'vehicle' ? 'Vehicle Type' : 'Category'}
                        </label>
                        {form.type === 'vehicle' ? (
                            <select
                                value={form.subtype}
                                onChange={e => set('subtype', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                            >
                                <option value="">Select type…</option>
                                {['Compactor Truck', 'Side Loader', 'Front Loader', 'Roll-off Truck', 'Mini Truck', 'Tractor', 'Other'].map(o => (
                                    <option key={o} value={o}>{o}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                value={form.subtype}
                                onChange={e => set('subtype', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                placeholder="e.g. Safety Gear, Hand Tool, Consumable"
                            />
                        )}
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={form.status}
                            onChange={e => set('status', e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                        >
                            {form.type === 'vehicle' ? (
                                <>
                                    <option value="active">Active</option>
                                    <option value="maintenance">Maintenance</option>
                                    <option value="inactive">Inactive</option>
                                </>
                            ) : (
                                <>
                                    <option value="good">Good</option>
                                    <option value="fair">Fair</option>
                                    <option value="low_stock">Low Stock</option>
                                </>
                            )}
                        </select>
                    </div>

                    {/* Quantity (equipment) or License Plate (vehicle) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {form.type === 'vehicle' ? 'Count' : 'Quantity'}
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={form.quantity}
                                onChange={e => set('quantity', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Est. Value (₹)
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={form.value}
                                onChange={e => set('value', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    {form.type === 'vehicle' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
                            <input
                                value={form.licensePlate}
                                onChange={e => set('licensePlate', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 uppercase"
                                placeholder="MH-01-AA-0000"
                            />
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            rows={2}
                            value={form.notes}
                            onChange={e => set('notes', e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                            placeholder="Optional notes…"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !form.name.trim()}
                            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {isEdit ? 'Save Changes' : 'Add Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Delete confirm ───────────────────────────────────────────────────────────
interface DeleteModalProps {
    item: InventoryItem;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ item, onClose, onConfirm }) => {
    const [deleting, setDeleting] = useState(false);
    const handleDelete = async () => {
        setDeleting(true);
        try { await onConfirm(); onClose(); } finally { setDeleting(false); }
    };
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Delete Item</h3>
                <p className="text-sm text-gray-600 text-center mb-6">
                    Remove <strong>{item.name}</strong> from inventory? This cannot be undone.
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const InventoryTab: React.FC = () => {
    const { t } = useLanguage();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [activeTab, setActiveTab] = useState<'vehicle' | 'equipment'>('vehicle');
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<InventoryItem | null>(null);
    const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);

    // ── Firestore listener
    useEffect(() => {
        let unsubscribe: () => void;
        try {
            const q = query(collection(db, 'inventory'), orderBy('lastUpdated', 'desc'));
            unsubscribe = onSnapshot(q, async (snap) => {
                if (snap.empty && !seeding) {
                    await seedDefaultData();
                } else {
                    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
                    setLoading(false);
                }
            }, () => {
                // fallback without ordering
                const q2 = query(collection(db, 'inventory'));
                unsubscribe = onSnapshot(q2, async (snap2) => {
                    if (snap2.empty && !seeding) {
                        await seedDefaultData();
                    } else {
                        setItems(snap2.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
                        setLoading(false);
                    }
                });
            });
        } catch {
            const q2 = query(collection(db, 'inventory'));
            unsubscribe = onSnapshot(q2, async (snap2) => {
                if (snap2.empty && !seeding) {
                    await seedDefaultData();
                } else {
                    setItems(snap2.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
                    setLoading(false);
                }
            });
        }
        return () => unsubscribe && unsubscribe();
    }, []);

    const seedDefaultData = async () => {
        // Check once more to avoid double-seeding
        const existing = await getDocs(collection(db, 'inventory'));
        if (!existing.empty) { setLoading(false); return; }
        setSeeding(true);
        try {
            await Promise.all(SEED_DATA.map(item =>
                addDoc(collection(db, 'inventory'), { ...item, lastUpdated: serverTimestamp() })
            ));
        } finally {
            setSeeding(false);
            setLoading(false);
        }
    };

    // ── CRUD
    const handleAdd = async (data: Partial<InventoryItem>) => {
        await addDoc(collection(db, 'inventory'), { ...data, lastUpdated: serverTimestamp() });
    };

    const handleEdit = async (data: Partial<InventoryItem>) => {
        if (!editItem) return;
        await updateDoc(doc(db, 'inventory', editItem.id), { ...data, lastUpdated: serverTimestamp() });
    };

    const handleDelete = async (item: InventoryItem) => {
        await deleteDoc(doc(db, 'inventory', item.id));
    };

    // ── Stats
    const vehicles = items.filter(i => i.type === 'vehicle');
    const equipment = items.filter(i => i.type === 'equipment');
    const totalVehicles = vehicles.reduce((s, v) => s + (v.quantity || 1), 0);
    const activeVehicles = vehicles.filter(v => v.status === 'active').reduce((s, v) => s + (v.quantity || 1), 0);
    const maintenanceDue = vehicles.filter(v => v.status === 'maintenance').length;
    const totalValue = items.reduce((s, i) => s + (i.value || 0), 0);

    // ── Filtered list
    const filtered = useMemo(() => {
        const list = items.filter(i => i.type === activeTab);
        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter(i =>
            i.name.toLowerCase().includes(q) ||
            (i.subtype ?? '').toLowerCase().includes(q) ||
            (i.licensePlate ?? '').toLowerCase().includes(q) ||
            i.status.toLowerCase().includes(q)
        );
    }, [items, activeTab, search]);

    if (loading || seeding) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                <p className="text-gray-500 text-sm">{seeding ? 'Setting up inventory…' : 'Loading inventory…'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('inventory_management')}</h2>
                    <p className="text-gray-600">{t('inventory_subtitle')}</p>
                </div>
                <button
                    onClick={() => { setEditItem(null); setModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md transition-all text-sm font-semibold"
                >
                    <Plus className="w-4 h-4" />
                    Add {activeTab === 'vehicle' ? 'Vehicle' : 'Equipment'}
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title={t('total_vehicles')}
                    value={totalVehicles.toString()}
                    icon={<Truck className="w-6 h-6" />}
                    color="blue"
                />
                <StatCard
                    title={t('active_vehicles')}
                    value={activeVehicles.toString()}
                    icon={<Activity className="w-6 h-6" />}
                    trend={{ value: `${totalVehicles > 0 ? ((activeVehicles / totalVehicles) * 100).toFixed(0) : 0}% operational`, isPositive: true }}
                    color="green"
                />
                <StatCard
                    title={t('maintenance_due')}
                    value={maintenanceDue.toString()}
                    icon={<AlertTriangle className="w-6 h-6" />}
                    color="yellow"
                />
                <StatCard
                    title={t('equipment_value')}
                    value={formatValue(totalValue)}
                    icon={<Package className="w-6 h-6" />}
                    color="purple"
                />
            </div>

            {/* Tab switcher + Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                    {(['vehicle', 'equipment'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSearch(''); }}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                                activeTab === tab
                                    ? 'bg-white text-emerald-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab === 'vehicle' ? `Vehicles (${vehicles.length})` : `Equipment (${equipment.length})`}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={`Search ${activeTab === 'vehicle' ? 'vehicles' : 'equipment'}…`}
                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white w-56"
                        />
                    </div>
                    <button
                        onClick={() => { setEditItem(null); setModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm transition-all text-sm font-semibold"
                    >
                        <Plus className="w-4 h-4" />
                        Add {activeTab === 'vehicle' ? 'Vehicle' : 'Equipment'}
                    </button>
                </div>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
                    <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-900 mb-1">
                        {search ? 'No results found' : `No ${activeTab === 'vehicle' ? 'vehicles' : 'equipment'} yet`}
                    </h4>
                    <p className="text-gray-500 text-sm">
                        {search ? 'Try a different search term.' : `Click "Add ${activeTab === 'vehicle' ? 'Vehicle' : 'Equipment'}" to get started.`}
                    </p>
                </div>
            ) : activeTab === 'vehicle' ? (
                /* Vehicles grid */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                        item.status === 'active' ? 'bg-emerald-50' : item.status === 'maintenance' ? 'bg-amber-50' : 'bg-red-50'
                                    }`}>
                                        {item.status === 'maintenance'
                                            ? <Wrench className="w-5 h-5 text-amber-500" />
                                            : item.status === 'active'
                                                ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                                                : <AlertTriangle className="w-5 h-5 text-red-500" />
                                        }
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h4>
                                        {item.subtype && <p className="text-xs text-gray-500">{item.subtype}</p>}
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${vehicleStatusBadge(item.status as VehicleStatus)}`}>
                                    {vehicleStatusLabel(item.status as VehicleStatus)}
                                </span>
                            </div>
                            <div className="space-y-1.5 text-xs text-gray-500">
                                {item.licensePlate && (
                                    <div className="flex items-center justify-between">
                                        <span>Plate</span>
                                        <span className="font-mono font-medium text-gray-700">{item.licensePlate}</span>
                                    </div>
                                )}
                                {item.value && (
                                    <div className="flex items-center justify-between">
                                        <span>Value</span>
                                        <span className="font-medium text-gray-700">{formatValue(item.value)}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span>Updated</span>
                                    <span>{formatDate(item.lastUpdated)}</span>
                                </div>
                                {item.notes && <p className="text-gray-400 italic mt-1 truncate">{item.notes}</p>}
                            </div>
                            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                                <button
                                    onClick={() => { setEditItem(item); setModalOpen(true); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button
                                    onClick={() => setDeleteItem(item)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Equipment table */
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('quantity_label')}</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('updated_label')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                                        {item.subtype && <p className="text-xs text-gray-500 mt-0.5">{item.subtype}</p>}
                                        {item.notes && <p className="text-xs text-gray-400 italic mt-0.5 truncate max-w-[200px]">{item.notes}</p>}
                                    </td>
                                    <td className="px-4 py-4 text-center font-semibold text-gray-900">{item.quantity.toLocaleString('en-IN')}</td>
                                    <td className="px-4 py-4 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${equipStatusBadge(item.status as EquipmentStatus)}`}>
                                            {equipStatusLabel(item.status as EquipmentStatus)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center text-sm text-gray-700">{formatValue(item.value)}</td>
                                    <td className="px-4 py-4 text-center text-xs text-gray-500">{formatDate(item.lastUpdated)}</td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setEditItem(item); setModalOpen(true); }}
                                                className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteItem(item)}
                                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            {modalOpen && (
                <ItemModal
                    item={editItem}
                    activeTab={activeTab}
                    onClose={() => { setModalOpen(false); setEditItem(null); }}
                    onSave={editItem ? handleEdit : handleAdd}
                />
            )}

            {/* Delete Modal */}
            {deleteItem && (
                <DeleteModal
                    item={deleteItem}
                    onClose={() => setDeleteItem(null)}
                    onConfirm={() => handleDelete(deleteItem)}
                />
            )}
        </div>
    );
};

export default InventoryTab;
