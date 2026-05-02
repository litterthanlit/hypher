import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="settings-api-keys-page">
      <div className="modal api-keys-panel api-keys-panel--page settings-hub">
        <div className="project-settings-header">
          <h3>Settings</h3>
          <Link href="/app" className="api-keys-back-link">
            Back to app
          </Link>
        </div>
        <div className="settings-hub-list">
          <Link href="/app/settings/api-keys" className="settings-hub-row">
            <span>
              <strong>API keys</strong>
              <small>Connect captures and agent handoffs through a Hypher key.</small>
            </span>
          </Link>
          <Link href="/app/settings/integrations" className="settings-hub-row">
            <span>
              <strong>Integrations</strong>
              <small>Connect GitHub repositories to projects.</small>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
