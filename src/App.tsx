import '@rainbow-me/rainbowkit/styles.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { darkTheme, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import ErrorBoundary from './components/ErrorBoundary'
import { wagmiConfig } from './config/wagmi'
import { SolanaWalletProvider } from './context/SolanaWalletContext'
import { SuiWalletProvider } from './context/SuiWalletContext'
import { WalletAuthProvider } from './context/WalletAuthContext'
import Landing from './pages/Landing'
import AppShell from './components/console/AppShell'
import Overview from './pages/console/Overview'
import Transfer from './pages/console/Transfer'
import Bridge from './pages/console/Bridge'
import UnifiedBalance from './pages/console/UnifiedBalance'
import Swap from './pages/console/Swap'
import Liquidity from './pages/console/Liquidity'
import Points from './pages/console/Points'
import Analytics from './pages/console/Analytics'
import YieldOptimizer from './pages/console/YieldOptimizer'
import SubAccounts from './pages/console/SubAccounts'
import Invoicing from './pages/console/Invoicing'
import Alerts from './pages/console/Alerts'
import Simulation from './pages/console/Simulation'
import Delegates from './pages/console/Delegates'
import RecurringPayments from './pages/console/RecurringPayments'
import Policy from './pages/console/Policy'
import Insurance from './pages/console/Insurance'
import PredictionMarkets from './pages/console/PredictionMarkets'
import StableFX from './pages/console/StableFX'
import AgentWallets from './pages/console/AgentWallets'
import AgenticJobs from './pages/console/AgenticJobs'
import AgentIdentity from './pages/console/AgentIdentity'
import Nanopayments from './pages/console/Nanopayments'
import AgentMarketplace from './pages/console/AgentMarketplace'

const queryClient = new QueryClient()

const rainbowKitTheme = darkTheme({
  accentColor: '#ffaaf6',
  accentColorForeground: '#5b005d',
  borderRadius: 'large',
  overlayBlur: 'small',
})

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowKitTheme}>
      <WalletAuthProvider>
      <SolanaWalletProvider>
      <SuiWalletProvider>
      <BrowserRouter>
      <ErrorBoundary>
        <Routes>
        <Route path="/" element={<Landing />} />

        <Route
          path="/console/overview"
          element={
            <AppShell pageTitle="Overview">
              <Overview />
            </AppShell>
          }
        />
        <Route
          path="/console/transfer"
          element={
            <AppShell pageTitle="Transfer">
              <Transfer />
            </AppShell>
          }
        />
        <Route
          path="/console/bridge"
          element={
            <AppShell pageTitle="Bridge">
              <Bridge />
            </AppShell>
          }
        />
        <Route
          path="/console/unified-balance"
          element={
            <AppShell pageTitle="Unified Balance">
              <UnifiedBalance />
            </AppShell>
          }
        />
        <Route
          path="/console/swap"
          element={
            <AppShell pageTitle="Swap">
              <Swap />
            </AppShell>
          }
        />
        <Route
          path="/console/liquidity"
          element={
            <AppShell pageTitle="Liquidity">
              <Liquidity />
            </AppShell>
          }
        />
        <Route
          path="/console/points"
          element={
            <AppShell pageTitle="Points">
              <Points />
            </AppShell>
          }
        />
        <Route
          path="/console/analytics"
          element={
            <AppShell pageTitle="Spending Analytics">
              <Analytics />
            </AppShell>
          }
        />
        <Route
          path="/console/yield-optimizer"
          element={
            <AppShell pageTitle="Yield Optimizer">
              <YieldOptimizer />
            </AppShell>
          }
        />
        <Route
          path="/console/sub-accounts"
          element={
            <AppShell pageTitle="Sub-Accounts">
              <SubAccounts />
            </AppShell>
          }
        />
        <Route
          path="/console/invoicing"
          element={
            <AppShell pageTitle="Invoicing">
              <Invoicing />
            </AppShell>
          }
        />
        <Route
          path="/console/alerts"
          element={
            <AppShell pageTitle="Alerts">
              <Alerts />
            </AppShell>
          }
        />
        <Route
          path="/console/simulation"
          element={
            <AppShell pageTitle="Simulation">
              <Simulation />
            </AppShell>
          }
        />
        <Route
          path="/console/delegates"
          element={
            <AppShell pageTitle="Delegate Permissions">
              <Delegates />
            </AppShell>
          }
        />
        <Route
          path="/console/recurring-payments"
          element={
            <AppShell pageTitle="Recurring Payments">
              <RecurringPayments />
            </AppShell>
          }
        />
        <Route
          path="/console/policy"
          element={
            <AppShell pageTitle="Policy">
              <Policy />
            </AppShell>
          }
        />
        <Route
          path="/console/insurance"
          element={
            <AppShell pageTitle="Insurance">
              <Insurance />
            </AppShell>
          }
        />
        <Route
          path="/console/prediction-markets"
          element={
            <AppShell pageTitle="Prediction Markets">
              <PredictionMarkets />
            </AppShell>
          }
        />
        <Route
          path="/console/stablefx"
          element={
            <AppShell pageTitle="StableFX">
              <StableFX />
            </AppShell>
          }
        />
        <Route
          path="/console/agent-wallets"
          element={
            <AppShell pageTitle="Agent Wallets">
              <AgentWallets />
            </AppShell>
          }
        />
        <Route
          path="/console/agentic-jobs"
          element={
            <AppShell pageTitle="Agentic Jobs">
              <AgenticJobs />
            </AppShell>
          }
        />
        <Route
          path="/console/agent-identity"
          element={
            <AppShell pageTitle="Agent Identity & Reputation">
              <AgentIdentity />
            </AppShell>
          }
        />
        <Route
          path="/console/nanopayments"
          element={
            <AppShell pageTitle="Nanopayments">
              <Nanopayments />
            </AppShell>
          }
        />
        <Route
          path="/console/agent-marketplace"
          element={
            <AppShell pageTitle="Agent Marketplace">
              <AgentMarketplace />
            </AppShell>
          }
        />
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
      </SuiWalletProvider>
      </SolanaWalletProvider>
      </WalletAuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
