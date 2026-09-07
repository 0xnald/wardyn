import { Shell } from '../../components/shell';
import { WorkspaceProvider } from '../../components/workspace-context';
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
