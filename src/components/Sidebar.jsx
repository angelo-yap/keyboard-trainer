export default function Sidebar({ tabs, activeTab, onTab }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brandMark" />
        <div className="brandText">
          <div className="brandName">
            Keyboard<span className="accent">Trainer</span>
          </div>
          <div className="brandSub">Desktop coach • Local progress</div>
        </div>
      </div>

      <nav className="nav">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`navItem ${activeTab === t.id ? "active" : ""}`}
            onClick={() => onTab(t.id)}
          >
            <span className="navIcon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="sidebarFooter">
        <div className="pill">Local Storage • No login</div>
        <div className="version">Version 0.2.0</div>
      </div>
    </aside>
  );
}