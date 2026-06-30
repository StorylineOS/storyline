import { Modal } from '../../components/Modal'
import { ConnectionGuide } from '../Generate/ConnectionGuide'

/** The "how to run ComfyUI" help (local + cloud cards), shown in a dismissable popup. */
export function ComfyHelpDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element | null {
  return (
    <Modal open={open} onClose={onClose} title="Connect your ComfyUI">
      <ConnectionGuide />
    </Modal>
  )
}
