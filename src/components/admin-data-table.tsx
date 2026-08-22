'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  DataTable,
  DataTableColumnsButton,
  DataTableFilterButton,
  Icon,
  SearchInput,
  type DataTableFilterOption,
  type DataTableLabels,
  type DataTableProps,
} from '@foundathyon/community-ui';
import { Trash2 } from 'lucide-react';
import { useI18n } from '@/context/i18n-context';

/** A faceted filter rendered as a toolbar button with a counter (§14, §16). */
export interface AdminDataTableFilter {
  id: string;
  label: string;
  options: DataTableFilterOption[];
  value: string[];
  onChange: (next: string[]) => void;
  /** @default true */
  multiple?: boolean;
  icon?: LucideIcon;
}

export interface AdminDataTableSearch {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}

export interface AdminDataTableProps<TData>
  extends Omit<DataTableProps<TData>, 'toolbar' | 'labels' | 'selection' | 'enableSelection'> {
  /** Entity noun for the footer summary — "3 de 128 usuarios". */
  entity: string;
  /** Search box, first in the toolbar. The page owns the (debounced, URL-backed) value. */
  search?: AdminDataTableSearch;
  /** Faceted filters, after the search. */
  filters?: AdminDataTableFilter[];
  /** Renders the "Columnas" toggle; primary columns are locked unless `lockedColumnIds` says otherwise. */
  columnsButton?: boolean;
  lockedColumnIds?: string[];
  /**
   * Row selection with a checkbox column. The table owns the selected ids and
   * prunes any that leave `data` (a deleted row never lingers in the count).
   */
  selectable?: boolean;
  /** Fired after every selection change — e.g. to clear it once a bulk action finishes. */
  onSelectionChange?: (selected: string[]) => void;
  /** Product copy overrides on top of the localized defaults. */
  labels?: DataTableLabels;
}

/**
 * AdminDataTable — the §14 list in its one frame, with this admin's copy wired
 * in: toolbar (search · filters · Columnas), table, footer ("N de M entidad").
 * Pages keep owning filter state (the URL is the state, §16) and just hand the
 * values down; the table never hides an applied filter behind a closed panel
 * because the filter button carries a counter.
 */
export function AdminDataTable<TData>({
  entity,
  search,
  filters,
  columnsButton,
  lockedColumnIds,
  selectable,
  onSelectionChange,
  labels,
  columns,
  columnVisibility,
  data,
  rowId,
  density = 'comfortable',
  ...rest
}: AdminDataTableProps<TData>) {
  const { t } = useI18n();

  // Column visibility: forward a controlled config as-is, otherwise own it so the
  // "Columnas" button and the table always agree.
  const [ownVisibility, setOwnVisibility] = useState<Record<string, boolean>>(
    () => columnVisibility?.defaultState ?? {}
  );
  const controlledVisibility = columnVisibility?.state !== undefined;
  const visibilityState = controlledVisibility ? columnVisibility!.state! : ownVisibility;
  const setVisibility = (next: Record<string, boolean>) => {
    if (!controlledVisibility) setOwnVisibility(next);
    columnVisibility?.onChange?.(next);
  };

  // Selection: controlled here so ids that vanish from `data` are dropped.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const liveIds = useMemo(() => new Set(data.map(rowId)), [data, rowId]);
  const selected = useMemo(
    () => selectedIds.filter((id) => liveIds.has(id)),
    [selectedIds, liveIds]
  );

  const lockedIds = lockedColumnIds ?? columns.filter((col) => col.primary).map((col) => col.id);
  const hasToolbar = Boolean(search) || Boolean(filters?.length) || Boolean(columnsButton);

  const toolbar = hasToolbar ? (
    <>
      {search && (
        <SearchInput
          value={search.value}
          onValueChange={search.onChange}
          placeholder={search.placeholder}
          aria-label={search.placeholder}
          clearLabel={t('common.clearSearch')}
          wrapperClassName="w-64"
        />
      )}
      {filters?.map((filter) => (
        <DataTableFilterButton
          key={filter.id}
          label={filter.label}
          options={filter.options}
          value={filter.value}
          onChange={filter.onChange}
          multiple={filter.multiple}
          icon={filter.icon}
          clearLabel={t('common.clearFilter')}
          emptyLabel={t('common.noOptions')}
        />
      ))}
      {columnsButton && (
        <DataTableColumnsButton
          columns={columns}
          value={visibilityState}
          onChange={setVisibility}
          label={t('common.columns')}
          lockedIds={lockedIds}
        />
      )}
    </>
  ) : undefined;

  const resolvedLabels: DataTableLabels = {
    loading: t('common.loading'),
    actions: t('common.actions'),
    selectAll: t('common.selectAll'),
    selectRow: t('common.selectRow'),
    clearSelection: t('common.clearSelection'),
    expandRow: t('common.expandRow'),
    collapseRow: t('common.collapseRow'),
    emptyTitle: t('common.noDataYet'),
    noResultsTitle: t('common.noResults'),
    errorTitle: t('common.somethingWentWrong'),
    of: (shown, total) => t('common.countOf', { shown, total, entity }),
    selectedCount: (count) =>
      count === 1 ? t('common.selectedOne') : t('common.selectedMany', { count }),
    ...labels,
  };

  return (
    <DataTable<TData>
      columns={columns}
      data={data}
      rowId={rowId}
      density={density}
      columnVisibility={{ state: visibilityState, onChange: setVisibility }}
      selection={
        selectable
          ? {
              selected,
              onChange: (next) => {
                setSelectedIds(next);
                onSelectionChange?.(next);
              },
            }
          : undefined
      }
      toolbar={toolbar}
      labels={resolvedLabels}
      {...rest}
    />
  );
}

/** The §14 "Eliminar selección" bulk action — destructive-subtle, in list context. */
export function DeleteSelectionButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const { t } = useI18n();
  return (
    <Button
      variant="destructive-subtle"
      className="border border-danger-border"
      leading={<Icon icon={Trash2} size={14} />}
      onClick={onClick}
    >
      {label ?? t('common.deleteSelection')}
    </Button>
  );
}

export interface BulkResult<TData> {
  done: number;
  failed: { item: TData; message: string }[];
}

/**
 * Runs `task` over `items` with bounded concurrency and never throws: every
 * failure is collected so the caller can report "4 de 6 eliminados · 2 con error".
 */
export async function runBulk<TData>(
  items: TData[],
  task: (item: TData) => Promise<void>,
  concurrency = 4
): Promise<BulkResult<TData>> {
  let cursor = 0;
  let done = 0;
  const failed: { item: TData; message: string }[] = [];
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++]!;
      try {
        await task(item);
        done++;
      } catch (error) {
        failed.push({ item, message: error instanceof Error ? error.message : String(error) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return { done, failed };
}

export interface DeleteSelectionDialogProps<TData> {
  /** Rows to delete; `null` keeps the dialog closed. */
  targets: TData[] | null;
  onClose: () => void;
  /** Plural entity noun for the copy — "usuarios", "API keys". */
  entity: string;
  /** Deletes ONE item; throw to mark it as failed. */
  deleteOne: (item: TData) => Promise<void>;
  /** Runs once the batch finished (refetch, clear selection). */
  onFinished: (result: BulkResult<TData>) => void | Promise<void>;
  /** Optional type-to-confirm phrase for irreversible deletions affecting others' data (§17). */
  confirmText?: string;
  confirmPrompt?: ReactNode;
}

/**
 * DeleteSelectionDialog — the §17 confirmation behind "Eliminar selección":
 * names the count and the consequence, the button says the verb, and the
 * dialog stays open (with the spinner) until every deletion resolved.
 */
export function DeleteSelectionDialog<TData>({
  targets,
  onClose,
  entity,
  deleteOne,
  onFinished,
  confirmText,
  confirmPrompt,
}: DeleteSelectionDialogProps<TData>) {
  const { t } = useI18n();
  const count = targets?.length ?? 0;
  return (
    <ConfirmDialog
      open={targets !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('common.deleteSelectedTitle', { count, entity })}
      description={t('common.deleteSelectedDesc', { count, entity })}
      verb={t('common.deleteSelectedVerb', { count })}
      cancelLabel={t('common.cancel')}
      confirmText={confirmText}
      confirmPrompt={confirmPrompt}
      onConfirm={async () => {
        if (!targets) return;
        const result = await runBulk(targets, deleteOne);
        await onFinished(result);
      }}
    />
  );
}
