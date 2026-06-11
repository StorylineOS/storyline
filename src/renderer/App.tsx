import { useEffect } from 'react'
import { useProjectStore } from './store/projectStore'
import { ProjectLauncher } from './views/ProjectLauncher/ProjectLauncher'
import { Workspace } from './views/Workspace/Workspace'

export function App(): React.JSX.Element {
  const current = useProjectStore((s) => s.current)
  const loadRecents = useProjectStore((s) => s.loadRecents)

  useEffect(() => {
    void loadRecents()
  }, [loadRecents])

  return current ? <Workspace project={current} /> : <ProjectLauncher />
}
