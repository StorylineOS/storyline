import { mediaUrl } from '@shared/media'
import { useAssetStore } from '../../store/assetStore'

/** Right panel: plays whichever asset is selected in the Library. */
export function PreviewPanel(): React.JSX.Element {
  const asset = useAssetStore((s) => s.assets.find((a) => a.id === s.selectedId))

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
        Preview
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden bg-black p-4">
        {!asset && <p className="text-sm text-zinc-600">Select an asset to preview</p>}

        {asset?.kind === 'image' && (
          <img
            src={mediaUrl(asset.filePath)}
            alt={asset.name}
            className="max-h-full max-w-full object-contain"
          />
        )}
        {asset?.kind === 'video' && (
          <video
            key={asset.id}
            src={mediaUrl(asset.filePath)}
            controls
            autoPlay
            className="max-h-full max-w-full"
          />
        )}
        {asset?.kind === 'audio' && (
          <audio key={asset.id} src={mediaUrl(asset.filePath)} controls className="w-2/3" />
        )}
      </div>
      {asset && (
        <div className="truncate border-t border-border px-3 py-1.5 text-xs text-zinc-500">
          {asset.name}
        </div>
      )}
    </div>
  )
}
