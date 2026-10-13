import type {WorkspaceModel} from '../src/types/workspace';
import type {SidebarProps} from '../src/components/Sidebar';
import type {ChatWorkspaceProps} from '../src/components/ChatWorkspace';
import type {ConnectionsSettingsViewProps} from '../src/components/ConnectionsSettingsView';
type Assert<T extends true> = T;
type Fits<A,B> = A extends B ? true : false;
export type SidebarContract = Assert<Fits<WorkspaceModel['onSidebarSelectSection'],SidebarProps['onSelectSection']>>;
export type ChatContract = Assert<Fits<WorkspaceModel['handleSendMessage'],ChatWorkspaceProps['onSendMessage']>>;
export type AccountContract = Assert<Fits<WorkspaceModel['account'],ConnectionsSettingsViewProps['account']>>;
// View cannot mutate the data store directly; commands are the reviewed boundary.
// @ts-expect-error State setters are deliberately not part of the view contract.
export type NoStoreSetter = WorkspaceModel['setMemories'];
