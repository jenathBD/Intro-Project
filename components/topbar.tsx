import { signOut } from '@/app/login/actions';

export function Topbar({ userName }: { userName: string }) {
  return (
    <div className="bd-topbar">
      <span className="bd-wordmark"><b>Better</b><span>Developers</span></span>
      <span className="bd-tool">Intro-Project</span>
      <span className="bd-spacer" />
      <span className="bd-meta">{userName}</span>
      <form action={signOut}>
        <button className="bd-btn bd-btn--ghost bd-btn--sm">Log ud</button>
      </form>
    </div>
  );
}
