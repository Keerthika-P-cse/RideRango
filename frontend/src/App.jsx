import { useEffect, useState } from 'react'
import { Activity, AlertCircle, CheckCircle2, Database, Layers, Server } from 'lucide-react'
import { api } from './services/api.js'
import './App.css'

function App() {
  const [backendState, setBackendState] = useState({
    loading: true,
    connected: false,
    data: null,
    error: null
  })

  useEffect(() => {
    let isMounted = true

    const verifyConnection = async () => {
      try {
        const response = await api.checkHealth()
        if (isMounted) {
          setBackendState({
            loading: false,
            connected: response.success,
            data: response.data,
            error: null
          })
        }
      } catch (err) {
        if (isMounted) {
          setBackendState({
            loading: false,
            connected: false,
            data: null,
            error: err.message || 'Backend connection unreachable'
          })
        }
      }
    }

    verifyConnection()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="app-shell">
      <header className="foundation-header">
        <div className="brand">
          Ride<span>Rango</span>
        </div>
        <div className="foundation-label">Velocity X // System Foundation</div>
      </header>

      <main className="foundation-content">
        <div className="eyebrow">Automotive Rental Platform</div>
        <h1>
          Engineered for <span>Speed.</span>
          <br />
          Built for <span>Scale.</span>
        </h1>
        <p className="foundation-description">
          RideRango vehicle rental management system foundation is operational.
          Configured with the Velocity X design system, Express REST backend, MySQL schema architecture, and React Router.
        </p>

        {/* System Diagnostic Status Grid */}
        <section className="status-grid" aria-label="System Foundation Status">
          {/* Frontend Module Status */}
          <div className="status-card">
            <div className="status-card-header">
              <span className="status-icon"><Layers size={18} /></span>
              <span className="status-title">Frontend Core</span>
              <span className="badge badge-success">
                <CheckCircle2 size={12} /> Active
              </span>
            </div>
            <div className="status-card-body">
              React 19 &bull; Vite &bull; React Router &bull; Lucide React
            </div>
          </div>

          {/* Backend API Status */}
          <div className="status-card">
            <div className="status-card-header">
              <span className="status-icon"><Server size={18} /></span>
              <span className="status-title">Backend Service</span>
              {backendState.loading ? (
                <span className="badge badge-pending">
                  <Activity size={12} className="spin" /> Checking
                </span>
              ) : backendState.connected ? (
                <span className="badge badge-success">
                  <CheckCircle2 size={12} /> Online
                </span>
              ) : (
                <span className="badge badge-error">
                  <AlertCircle size={12} /> Offline
                </span>
              )}
            </div>
            <div className="status-card-body">
              {backendState.loading && 'Connecting to /api/v1/health...'}
              {backendState.connected && (
                <span>
                  {backendState.data?.service} (v{backendState.data?.version})
                </span>
              )}
              {!backendState.loading && !backendState.connected && (
                <span className="text-muted">
                  Backend offline &bull; Start server using <code>npm run dev</code> in <code>backend/</code>
                </span>
              )}
            </div>
          </div>

          {/* Database Status */}
          <div className="status-card">
            <div className="status-card-header">
              <span className="status-icon"><Database size={18} /></span>
              <span className="status-title">MySQL Database</span>
              {backendState.connected && backendState.data?.database?.connected ? (
                <span className="badge badge-success">
                  <CheckCircle2 size={12} /> Connected
                </span>
              ) : backendState.connected ? (
                <span className="badge badge-warning">
                  <AlertCircle size={12} /> Pending DB
                </span>
              ) : (
                <span className="badge badge-neutral">Schema Ready</span>
              )}
            </div>
            <div className="status-card-body">
              {backendState.connected && backendState.data?.database?.connected
                ? 'MySQL Database pool active & connected'
                : '11 Tables & Seed SQL prepared (database/schema.sql)'}
            </div>
          </div>
        </section>
      </main>

      <footer className="foundation-footer">
        <div>RideRango &bull; Vehicle Rental Management System</div>
        <div>
          Velocity X Design System &bull; <span>Milestone 2 Foundation</span>
        </div>
      </footer>
    </div>
  )
}

export default App
