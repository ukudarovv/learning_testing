import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, CheckCircle, XCircle, CornerDownRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { userCategoriesService, type UserCategoryPayload } from '../../services/userCategories';
import type { UserCategory } from '../../types/lms';
import { ApiError } from '../../services/api';

function collectDescendantIds(
  rootId: string,
  childrenByParent: Map<string | null, UserCategory[]>
): Set<string> {
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const kids = childrenByParent.get(id) || [];
    for (const ch of kids) {
      const sid = String(ch.id);
      out.add(sid);
      stack.push(sid);
    }
  }
  return out;
}

function buildChildrenMap(rows: UserCategory[]): Map<string | null, UserCategory[]> {
  const m = new Map<string | null, UserCategory[]>();
  for (const c of rows) {
    const pid = c.parent == null || c.parent === '' ? null : String(c.parent);
    const arr = m.get(pid) ?? [];
    arr.push(c);
    m.set(pid, arr);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id)));
  }
  return m;
}

function depthOf(id: string, byId: Map<string, UserCategory>): number {
  let d = 0;
  let cur: UserCategory | undefined = byId.get(id);
  const guard = 64;
  while (cur && cur.parent != null && cur.parent !== '' && d < guard) {
    d += 1;
    cur = byId.get(String(cur.parent));
  }
  return d;
}

/** Обход дерева в порядке «родитель → дети»; при поиске — только ветки к совпадениям (с предками). */
function buildTreeRows(
  childrenByParent: Map<string | null, UserCategory[]>,
  byId: Map<string, UserCategory>,
  rows: UserCategory[],
  searchRaw: string
): { node: UserCategory; depth: number }[] {
  const q = searchRaw.trim().toLowerCase();
  let visible: Set<string> | null = null;
  if (q) {
    visible = new Set<string>();
    const matches: string[] = [];
    for (const c of rows) {
      if (
        c.name.toLowerCase().includes(q) ||
        (c.name_kz || '').toLowerCase().includes(q) ||
        (c.name_en || '').toLowerCase().includes(q)
      ) {
        matches.push(String(c.id));
      }
    }
    for (const mid of matches) {
      let cur: UserCategory | undefined = byId.get(mid);
      while (cur) {
        visible.add(String(cur.id));
        if (cur.parent == null || cur.parent === '') break;
        cur = byId.get(String(cur.parent));
      }
    }
  }

  const out: { node: UserCategory; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    const kids = childrenByParent.get(parentId) ?? [];
    for (const c of kids) {
      const id = String(c.id);
      if (visible && !visible.has(id)) continue;
      out.push({ node: c, depth });
      walk(id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function UserCategoriesManagement() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<UserCategory | null>(null);
  const [form, setForm] = useState<UserCategoryPayload & { name: string }>({
    name: '',
    name_kz: '',
    name_en: '',
    parent: null,
    order: 0,
    is_active: true,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userCategoriesService.getList();
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('admin.userCategories.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(() => {
    const m = new Map<string, UserCategory>();
    for (const c of rows) m.set(String(c.id), c);
    return m;
  }, [rows]);

  const childrenByParent = useMemo(() => buildChildrenMap(rows), [rows]);

  const parentOptions = useMemo(() => {
    const editingId = editing ? String(editing.id) : '';
    const banned = new Set<string>();
    if (editingId) {
      banned.add(editingId);
      for (const id of collectDescendantIds(editingId, childrenByParent)) {
        banned.add(id);
      }
    }
    return rows
      .filter((c) => !banned.has(String(c.id)))
      .sort(
        (a, b) =>
          depthOf(String(a.id), byId) - depthOf(String(b.id), byId) ||
          a.order - b.order ||
          String(a.name).localeCompare(String(b.name))
      );
  }, [rows, byId, childrenByParent, editing]);

  const treeRows = useMemo(
    () => buildTreeRows(childrenByParent, byId, rows, search),
    [childrenByParent, byId, rows, search]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      name_kz: '',
      name_en: '',
      parent: null,
      order: 0,
      is_active: true,
    });
    setEditorOpen(true);
  };

  const openEdit = (c: UserCategory) => {
    setEditing(c);
    setForm({
      name: c.name,
      name_kz: c.name_kz || '',
      name_en: c.name_en || '',
      parent: c.parent == null ? null : Number(c.parent),
      order: c.order,
      is_active: c.is_active,
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('admin.userCategories.nameRequired'));
      return;
    }
    const payload: UserCategoryPayload = {
      name: form.name.trim(),
      name_kz: form.name_kz?.trim() || '',
      name_en: form.name_en?.trim() || '',
      parent: form.parent === null || form.parent === undefined ? null : form.parent,
      order: form.order ?? 0,
      is_active: form.is_active !== false,
    };
    try {
      if (editing) {
        await userCategoriesService.update(editing.id, payload);
        toast.success(t('admin.userCategories.updateSuccess'));
      } else {
        await userCategoriesService.create(payload);
        toast.success(t('admin.userCategories.createSuccess'));
      }
      setEditorOpen(false);
      setEditing(null);
      load();
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : (e as Error)?.message;
      toast.error(msg || t('admin.userCategories.saveError'));
    }
  };

  const handleDelete = async (c: UserCategory) => {
    const hasKids = (childrenByParent.get(String(c.id)) || []).length > 0;
    const msg = hasKids
      ? t('admin.userCategories.deleteConfirmChildren')
      : t('admin.userCategories.deleteConfirm');
    if (!window.confirm(msg)) return;
    try {
      await userCategoriesService.delete(c.id);
      toast.success(t('admin.userCategories.deleteSuccess'));
      load();
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : (e as Error)?.message;
      toast.error(msg || t('admin.userCategories.deleteError'));
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">{t('admin.userCategories.loading')}</p>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={load}>
          {t('admin.userCategories.tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900">{t('admin.userCategories.title')}</h2>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4" />
            {t('admin.userCategories.addCategory')}
          </button>
        </div>
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            placeholder={t('admin.userCategories.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  {t('admin.userCategories.name')}
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  {t('admin.userCategories.order')}
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  {t('admin.userCategories.status')}
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  {t('admin.userCategories.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {treeRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    {t('admin.userCategories.empty')}
                  </td>
                </tr>
              ) : (
                treeRows.map(({ node: c, depth }) => {
                  const indent = Math.min(depth, 12) * 18;
                  const hasChildren = (childrenByParent.get(String(c.id)) || []).length > 0;
                  return (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center gap-1.5 font-medium text-gray-900"
                          style={{ paddingLeft: indent }}
                        >
                          {depth > 0 && (
                            <CornerDownRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden />
                          )}
                          <span className={hasChildren ? 'font-semibold' : undefined}>{c.name}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">{c.order}</td>
                      <td className="py-3 px-4">
                        {c.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            <CheckCircle className="w-3 h-3" />
                            {t('admin.userCategories.active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            <XCircle className="w-3 h-3" />
                            {t('admin.userCategories.inactive')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          className="text-blue-600 hover:underline mr-3 text-sm"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="w-4 h-4 inline mr-1" />
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:underline text-sm"
                          onClick={() => handleDelete(c)}
                        >
                          <Trash2 className="w-4 h-4 inline mr-1" />
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              {editing ? t('admin.userCategories.edit') : t('admin.userCategories.create')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.userCategories.name')} *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.userCategories.nameKz')}</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={form.name_kz || ''}
                    onChange={(e) => setForm({ ...form, name_kz: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.userCategories.nameEn')}</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={form.name_en || ''}
                    onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.userCategories.parent')}</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={form.parent === null || form.parent === undefined ? '' : String(form.parent)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm({ ...form, parent: v === '' ? null : Number(v) });
                  }}
                >
                  <option value="">{t('admin.userCategories.rootOption')}</option>
                  {parentOptions.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {'—'.repeat(Math.min(depthOf(String(o.id), byId), 6))} {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.userCategories.order')}</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={form.order ?? 0}
                  onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active !== false}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                <span className="text-sm">{t('admin.userCategories.active')}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg" onClick={() => setEditorOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={handleSave}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
