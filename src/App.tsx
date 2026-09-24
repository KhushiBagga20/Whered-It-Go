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
import { Hill } from './components/world/Hill'
import { Sun } from './components/world/Sun'
import { World } from './components/world/World'
import { useIsDesktop, useIsWide } from './hooks/useMedia'
import { MascotSpot } from './mascot/MascotSpot'
import { react } from './mascot/react'
import Dashboard from './pages/Dashboard'
import { startClock, useMonth, useMonthProgress } from './state/selectors'
import { startNudgeWatcher } from './lib/notifications'
import { isCloudConfigured } from './lib/supabase'
import { boot, useData } from './state/store'
import { ui, useUi } from './state/ui'
import styles from './App.module.css'

const loadFeatures = () => import('./animations/features').then((r) => r.default)

const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const MoneyPage = lazy(() => import('./pages/MoneyPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
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

  // Cloud: react to sign-in/out that happens elsewhere (magic link, another tab, expired session).
  useEffect(() => {
    if (!isCloudConfigured) return
    let unsub: (() => void) | undefined
    void import('./lib/supabase').then(async ({ getSupabase }) => {
      const sb = await getSupabase()
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        const status = useData.getState().status
        if (event === 'SIGNED_OUT' && status !== 'signed-out') void boot()
        if (event === 'SIGNED_IN' && session && status === 'signed-out') void boot()
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
        {status === 'ready' && <Shell />}
      </MotionConfig>
    </LazyMotion>
  )
}

function Shell() {
  const desktop = useIsDesktop()
  const wide = useIsWide()
  const [location] = useLocation()
  const month = useMonth()
  const progress = useMonthProgress(month)
  const reaction = useUi((s) => s.reaction)

  // Slide pages in the direction of travel along the nav.
  const index = navIndex(location)
  const [nav, setNav] = useState({ index, dir: 1 })
  if (nav.index !== index) setNav({ index, dir: index >= nav.index ? 1 : -1 })
  const dir = nav.dir
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [index])

  // Nudges (only fire if the user turned them on and granted permission).
  useEffect(
    () =>
      startNudgeWatcher(() => {
        const s = useData.getState()
        return { txns: s.transactions, prefs: s.profile.prefs.notifications }
      }),
    [],
  )

  // Home-screen shortcut: /?add=expense opens the composer straight away.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const add = params.get('add')
    if (add === 'expense' || add === 'income') {
      ui.openComposer({ type: add })
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
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
    <div className={styles.shell} data-desktop={desktop || undefined} data-wide={wide || undefined}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      {desktop && <SideRail />}
      <div className={styles.main}>
        {!wide && (
          <div className={styles.sun}>
            <Sun progress={progress} size={desktop ? 120 : 104} />
          </div>
        )}
        <Header />
        <main id="main" className={styles.content} tabIndex={-1}>
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <m.div key={location} custom={dir} variants={pageVariants} initial="enter" animate="center" exit="exit">
              <Suspense fallback={<div className={styles.loading} aria-busy="true" />}>
                <Switch location={location}>
                  <Route path="/" component={Dashboard} />
                  <Route path="/calendar" component={CalendarPage} />
                  <Route path="/history" component={HistoryPage} />
                  <Route path="/money" component={MoneyPage} />
                  <Route path="/settings" component={SettingsPage} />
                  <Route>
                    <Dashboard />
                  </Route>
                </Switch>
              </Suspense>
            </m.div>
          </AnimatePresence>
        </main>
      </div>
      {wide && <Aside />}
      <Hill desktop={desktop}>
        {!desktop && <BottomNav />}
        {!wide && (
          <div className={styles.stage}>
            <MascotSpot stage pose="sit" size={50} bubble={desktop ? 'left' : 'right'} />
          </div>
        )}
      </Hill>
      <TransactionComposer />
      <TransactionDetail />
      <DaySheet />
      <Toasts />
      <BurstLayer />
      <div className="sr-only" aria-live="polite">
        {reaction?.message}
      </div>
    </div>
  )
}
