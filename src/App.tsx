import { AnimatePresence, LazyMotion, m, MotionConfig } from 'motion/react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { pageVariants } from './animations/variants'
import { BurstLayer } from './animations/BurstLayer'
import { Aside } from './components/Aside'
import { DaySheet } from './components/DaySheet'
import { ErrorState } from './components/ErrorState'
import { Header } from './components/Header'
import { BottomNav } from './components/nav/BottomNav'
import { navIndex } from './components/nav/navItems'
import { SideRail } from './components/nav/SideRail'
import { Splash } from './components/Splash'
import { Toasts } from './components/Toasts'
import { TransactionComposer } from './components/TransactionComposer'
import { TransactionDetail } from './components/TransactionDetail'
import { WaitingForJais } from './components/WaitingForJais'
import { Hill } from './components/world/Hill'
import { Sun } from './components/world/Sun'
import { World } from './components/world/World'
import { useLedgerSync } from './hooks/useLedgerSync'
import { useLayout } from './hooks/useMedia'
import { isCloudConfigured } from './lib/supabase'
import { MascotSpot } from './mascot/MascotSpot'
import { react } from './mascot/react'
import Dashboard from './pages/Dashboard'
import { startClock, useMonth, useMonthProgress } from './state/selectors'
import { boot, isObserver, useData } from './state/store'
import { ui, useUi } from './state/ui'
import styles from './App.module.css'

const loadFeatures = () => import('./animations/features').then((r) => r.default)

const ObserverDashboard = lazy(() => import('./pages/ObserverDashboard'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const MoneyPage = lazy(() => import('./pages/MoneyPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const MascotGallery = lazy(() => import('./pages/MascotGallery'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const Onboarding = lazy(() => import('./pages/Onboarding'))

export default function App() {
  const status = useData((s) => s.status)
  const motion = useData((s) => s.profile.prefs.motion)
  const bootError = useData((s) => s.bootError)

  useEffect(() => {
    startClock()
    void boot()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.motion = motion
  }, [motion])

  // Cloud: signed out somewhere else, or the session expired → back to "who are you?".
  useEffect(() => {
    if (!isCloudConfigured) return
    let unsub: (() => void) | undefined
    void import('./lib/supabase').then(async ({ getSupabase }) => {
      const sb = await getSupabase()
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT' && useData.getState().status !== 'signed-out') void boot()
      })
      unsub = () => data.subscription.unsubscribe()
    })
    return () => unsub?.()
  }, [])

  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion={motion === 'minimal' ? 'always' : 'user'}>
        <World />
        {status === 'booting' && <Splash />}
        {status === 'error' && (
          <main className={styles.center}>
            <ErrorState message={bootError?.message} detail={bootError?.detail} onRetry={() => void boot()} />
          </main>
        )}
        <Suspense fallback={<Splash />}>
          {status === 'signed-out' && <AuthPage />}
          {status === 'onboarding' && <Onboarding />}
        </Suspense>
        {status === 'waiting' && <WaitingForJais />}
        {status === 'ready' && <Shell />}
        {/* outside the shell so the "new version" slip also shows before sign-in */}
        <Toasts top={status !== 'ready'} />
      </MotionConfig>
    </LazyMotion>
  )
}

function Home() {
  const observer = useData((s) => s.viewer?.role === 'observer')
  return observer ? <ObserverDashboard /> : <Dashboard />
}

function Shell() {
  const layout = useLayout()
  const [location] = useLocation()
  const month = useMonth()
  const progress = useMonthProgress(month)
  const reaction = useUi((s) => s.reaction)
  useLedgerSync()

  // Slide pages in the direction of travel along the nav.
  const index = navIndex(location)
  const [nav, setNav] = useState({ index, dir: 1 })
  if (nav.index !== index) setNav({ index, dir: index >= nav.index ? 1 : -1 })
  const dir = nav.dir
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [index])

  // Home-screen shortcut: /?add=expense opens the composer straight away (Jais only).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const add = params.get('add')
    if ((add === 'expense' || add === 'income') && !isObserver()) ui.openComposer({ type: add })
    if (add) window.history.replaceState(window.history.state, '', window.location.pathname)
  }, [])

  // She says hi once per session.
  useEffect(() => {
    if (sessionStorage.getItem('wig:greeted')) return
    const t = window.setTimeout(() => {
      sessionStorage.setItem('wig:greeted', '1')
      react('greet')
    }, 1600)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className={styles.shell} data-layout={layout.mode} data-rail={layout.rail || undefined}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      {layout.rail && <SideRail compact={layout.compactRail} />}
      <div className={styles.main}>
        {!layout.aside && (
          <div className={styles.sun}>
            <Sun progress={progress} size={layout.rail ? 120 : layout.mode === 'cover' ? 88 : 104} />
          </div>
        )}
        <Header />
        <main id="main" className={styles.content} tabIndex={-1}>
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <m.div key={location} custom={dir} variants={pageVariants} initial="enter" animate="center" exit="exit">
              <Suspense fallback={<div className={styles.loading} aria-busy="true" />}>
                <Switch location={location}>
                  <Route path="/" component={Home} />
                  <Route path="/calendar" component={CalendarPage} />
                  <Route path="/history" component={HistoryPage} />
                  <Route path="/money" component={MoneyPage} />
                  <Route path="/settings" component={SettingsPage} />
                  <Route path="/mascot" component={MascotGallery} />
                  <Route>
                    <Home />
                  </Route>
                </Switch>
              </Suspense>
            </m.div>
          </AnimatePresence>
        </main>
      </div>
      {layout.aside && <Aside />}
      <Hill desktop={layout.rail}>
        {!layout.rail && <BottomNav />}
        {!layout.aside && (
          <div className={styles.stage}>
            <MascotSpot stage pose="sit" size={layout.mode === 'cover' ? 44 : 50} bubble={layout.rail ? 'left' : 'right'} />
          </div>
        )}
      </Hill>
      <TransactionComposer />
      <TransactionDetail />
      <DaySheet />
      <BurstLayer />
      <div className="sr-only" aria-live="polite">
        {reaction?.message}
      </div>
    </div>
  )
}
