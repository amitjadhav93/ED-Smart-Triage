import { useCallback, useEffect, useRef, useState } from 'react'
import TopBar from './components/TopBar.jsx'
import SignInPanel from './components/SignInPanel.jsx'
import QueueBoard from './components/QueueBoard.jsx'
import IntakeForm from './components/IntakeForm.jsx'
import PatientDetail from './components/PatientDetail.jsx'
import AuditLog from './components/AuditLog.jsx'
import ValidationReport from './components/ValidationReport.jsx'
import IntegrationHospitalPanel from './components/IntegrationHospitalPanel.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import { listPatients, getStats, getBeds, startSurge, endSurge, ApiError } from './api/client.js'

const POLL_INTERVAL_MS = 7000

export default function App() {
  const [auth, setAuth] = useState(null)
  const [signInVisible, setSignInVisible] = useState(true)
  const [signInMessage, setSignInMessage] = useState('')

  const [activeTab, setActiveTab] = useState('board')

  const [patients, setPatients] = useState([])
  const [stats, setStats] = useState(null)
  const [beds, setBeds] = useState(null)
  const [surgeModeActive, setSurgeModeActive] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [showIntake, setShowIntake] = useState(false)

  const [surgeSubmitting, setSurgeSubmitting] = useState(false)
  const [surgeEnding, setSurgeEnding] = useState(false)

  const pollRef = useRef(null)

  const refreshBoard = useCallback(async () => {
    try {
      const [patientData, statsData, bedsData] = await Promise.all([
        listPatients(),
        getStats(),
        getBeds()
      ])
      // The patients endpoint is documented as returning a plain Patient[],
      // but surgeModeActive is said to ride alongside it — support both a
      // bare array and an { patients, surgeModeActive } envelope so either
      // backend shape works.
      const patientsArr = Array.isArray(patientData) ? patientData : (patientData?.patients || [])
      const surgeFromPatients = Array.isArray(patientData) ? undefined : patientData?.surgeModeActive

      setPatients(patientsArr)
      setStats(statsData)
      setBeds(bedsData)
      setSurgeModeActive(Boolean(surgeFromPatients ?? statsData?.surgeModeActive))
      setFetchError('')
    } catch (err) {
      setFetchError(err.message || 'Could not reach the triage server.')
    }
  }, [])

  useEffect(() => {
    refreshBoard()
    pollRef.current = setInterval(refreshBoard, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [refreshBoard])

  function requireAuth(message) {
    setSignInMessage(message || '')
    setSignInVisible(true)
  }

  function handleSignIn({ name, token }) {
    setAuth({ name, token })
    setSignInVisible(false)
    setSignInMessage('')
  }

  function handleSignOut() {
    setAuth(null)
  }

  function handlePatientUpdated(updated) {
    setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  function handlePatientCreated() {
    refreshBoard()
  }

  async function handleTriggerSurge(count) {
    if (!auth) { requireAuth(); return }
    setSurgeSubmitting(true)
    try {
      await startSurge(count, auth.token)
      await refreshBoard()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        requireAuth('Session token invalid or missing — please sign in again')
      } else {
        setFetchError(err.message || 'Could not trigger surge.')
      }
    } finally {
      setSurgeSubmitting(false)
    }
  }

  async function handleEndSurge() {
    if (!auth) { requireAuth(); return }
    setSurgeEnding(true)
    try {
      await endSurge(auth.token)
      await refreshBoard()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        requireAuth('Session token invalid or missing — please sign in again')
      } else {
        setFetchError(err.message || 'Could not end surge mode.')
      }
    } finally {
      setSurgeEnding(false)
    }
  }

  const patientsById = Object.fromEntries(patients.map((p) => [p.id, p]))
  const selectedPatient = selectedPatientId ? patientsById[selectedPatientId] : null

  return (
    <div className="app-shell">
      <TopBar
        auth={auth}
        onSignInClick={() => requireAuth()}
        onSignOut={handleSignOut}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="view">
        <ErrorBanner message={fetchError} onDismiss={() => setFetchError('')} />

        {activeTab === 'board' && !showIntake && (
          <QueueBoard
            patients={patients}
            stats={stats}
            beds={beds}
            auth={auth}
            surgeActive={surgeModeActive}
            onSelectPatient={setSelectedPatientId}
            onOpenIntake={() => setShowIntake(true)}
            onTriggerSurge={handleTriggerSurge}
            onEndSurge={handleEndSurge}
            surgeSubmitting={surgeSubmitting}
            surgeEnding={surgeEnding}
          />
        )}

        {activeTab === 'board' && showIntake && (
          <IntakeForm
            auth={auth}
            onCreated={handlePatientCreated}
            onClose={() => setShowIntake(false)}
            onRequireAuth={requireAuth}
          />
        )}

        {activeTab === 'audit' && <AuditLog patientsById={patientsById} />}
        {activeTab === 'validation' && <ValidationReport />}
        {activeTab === 'system' && <IntegrationHospitalPanel />}
      </main>

      {selectedPatient && (
        <PatientDetail
          patient={selectedPatient}
          auth={auth}
          onClose={() => setSelectedPatientId(null)}
          onUpdated={handlePatientUpdated}
          onRequireAuth={requireAuth}
        />
      )}

      {signInVisible && (
        <SignInPanel
          onSignIn={handleSignIn}
          onClose={auth ? undefined : () => setSignInVisible(false)}
          forcedMessage={signInMessage}
        />
      )}
    </div>
  )
}
