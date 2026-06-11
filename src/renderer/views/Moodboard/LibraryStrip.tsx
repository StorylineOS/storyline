import { mediaUrl } from '@shared/media'
import { useAssetStore } from '../../store/assetStore'

/**
 * The moodboard's rail onto the shared asset library. Click an asset to drop it on
 * the canvas; Import adds media to the shared library AND the board. (Folder
 * navigation in the rail is a later refinement — slice 1 lists all media.)
 */
export function LibraryStrip({
  onAddAsset,
  onImport,
  onAddText,
}: {
  onAddAsset: (assetId: string) => void
  onImport: () => void
  onAddText: () => void
}): React.JSX.Element {
  const assets = useAssetStore((s) => s.assets)

  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-2">
        <button
          onClick={onImport}
          className="flex-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white"
        >
          Import
        </button>
        <button
          onClick={onAddText}
          className="flex-1 rounded-md border border-border px-2 py-1 text-xs text-zinc-300 hover:bg-surface"
        >
          Add Text
        </button>
      </div>

      {assets.length === 0 ? (
        <p className="p-3 text-xs text-zinc-600">
          No media yet. Import to add it to the board and the shared library.
        </p>
      ) : (
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-2">
          {assets.map((asset) => {
            const url = mediaUrl(asset.filePath)
            return (
              <button
                key={asset.id}
                onClick={() => onAddAsset(asset.id)}
                title={`Add "${asset.name}" to board`}
                className="flex flex-col overflow-hidden rounded-md border border-border text-left hover:border-accent"
              >
                <div className="flex aspect-video items-center justify-center bg-black/40">
                  {asset.kind === 'image' && (
                    <img src={url} alt={asset.name} className="h-full w-full object-cover" />
                  )}
                  {asset.kind === 'video' && (
                    <video
                      src={url}
                      muted
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  )}
                  {asset.kind === 'audio' && <span className="text-xl">🎵</span>}
                </div>
                <span className="truncate px-1 py-0.5 text-[10px] text-zinc-400">{asset.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
