import { useEffect, useState } from 'react'
import { mediaUrl } from '@shared/media'
import type { Asset, AssetFolder } from '@shared/types'
import { useAssetStore, folderPath } from '../../store/assetStore'

/** Left panel: folder navigation + import + a grid of folders and media. */
export function LibraryPanel(): React.JSX.Element {
  const {
    folders,
    assets,
    currentFolderId,
    selectedId,
    loading,
    error,
    load,
    import: importAssets,
    createFolder,
    deleteFolder,
    navigate,
    select,
  } = useAssetStore()
  const [newFolderName, setNewFolderName] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  const path = folderPath(folders, currentFolderId)
  const subFolders = folders.filter((f) => f.parentId === currentFolderId)
  const folderAssets = assets.filter((a) => a.folderId === currentFolderId)
  const empty = subFolders.length === 0 && folderAssets.length === 0

  const submitNewFolder = (): void => {
    const name = (newFolderName ?? '').trim()
    if (name) void createFolder(name)
    setNewFolderName(null)
  }

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Assets</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setNewFolderName('')}
            className="rounded-md border border-border px-2 py-1 text-xs text-zinc-300 hover:bg-surface"
          >
            New Folder
          </button>
          <button
            onClick={() => void importAssets()}
            disabled={loading}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            Import
          </button>
        </div>
      </div>

      <Breadcrumb path={path} onNavigate={navigate} />

      {error && <p className="px-3 py-2 text-xs text-red-400">{error}</p>}

      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-2">
        {newFolderName !== null && (
          <div className="col-span-2">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewFolder()
                if (e.key === 'Escape') setNewFolderName(null)
              }}
              onBlur={submitNewFolder}
              placeholder="Folder name"
              className="w-full rounded-md border border-accent bg-surface px-2 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </div>
        )}

        {subFolders.map((folder) => (
          <FolderTile
            key={folder.id}
            folder={folder}
            onOpen={() => navigate(folder.id)}
            onDelete={() => void deleteFolder(folder.id)}
          />
        ))}

        {folderAssets.map((asset) => (
          <AssetThumb
            key={asset.id}
            asset={asset}
            selected={asset.id === selectedId}
            onSelect={() => select(asset.id)}
          />
        ))}

        {empty && newFolderName === null && (
          <div className="col-span-2 flex flex-col items-center justify-center gap-1 p-6 text-center">
            <p className="text-sm text-zinc-500">This folder is empty</p>
            <p className="text-xs text-zinc-600">Import media or create a folder.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Breadcrumb({
  path,
  onNavigate,
}: {
  path: AssetFolder[]
  onNavigate: (id: string | null) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-1.5 text-xs text-zinc-400">
      <button onClick={() => onNavigate(null)} className="hover:text-zinc-200">
        Library
      </button>
      {path.map((f) => (
        <span key={f.id} className="flex items-center gap-1">
          <span className="text-zinc-600">/</span>
          <button onClick={() => onNavigate(f.id)} className="hover:text-zinc-200">
            {f.name}
          </button>
        </span>
      ))}
    </div>
  )
}

function FolderTile({
  folder,
  onOpen,
  onDelete,
}: {
  folder: AssetFolder
  onOpen: () => void
  onDelete: () => void
}): React.JSX.Element {
  return (
    <div className="group relative">
      <button
        onDoubleClick={onOpen}
        onClick={onOpen}
        title={folder.name}
        className="flex w-full flex-col items-center gap-1 rounded-md border border-border bg-surface px-2 py-3 hover:border-zinc-600"
      >
        <span className="text-2xl leading-none">📁</span>
        <span className="w-full truncate text-center text-[11px] text-zinc-300">{folder.name}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        title="Delete folder (keeps its media)"
        className="absolute right-1 top-1 hidden rounded bg-black/60 px-1 text-[10px] text-zinc-300 group-hover:block hover:text-red-400"
      >
        ✕
      </button>
    </div>
  )
}

function AssetThumb({
  asset,
  selected,
  onSelect,
}: {
  asset: Asset
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const url = mediaUrl(asset.filePath)
  return (
    <button
      onClick={onSelect}
      title={asset.name}
      className={`group flex flex-col overflow-hidden rounded-md border text-left ${
        selected ? 'border-accent' : 'border-border hover:border-zinc-600'
      }`}
    >
      <div className="flex aspect-video items-center justify-center bg-black/40">
        {asset.kind === 'image' && (
          <img src={url} alt={asset.name} className="h-full w-full object-cover" />
        )}
        {asset.kind === 'video' && (
          <video src={url} muted preload="metadata" className="h-full w-full object-cover" />
        )}
        {asset.kind === 'audio' && <span className="text-2xl">🎵</span>}
      </div>
      <span className="truncate px-1.5 py-1 text-[11px] text-zinc-400">{asset.name}</span>
    </button>
  )
}
