import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { ToastHost } from '@/components/primitives'
import { SessionProvider, RequireRole } from '@/components/Shell'

import { Lobby, Login, Signup, ResetPassword, Onboarding } from '@/routes/auth'
import {
  Browse, SearchPage, Category, Watch, Watchlist, History, ForYou,
  Notifications, NotificationPrefs, Profile, Help,
} from '@/routes/viewer'
import { Plans, Checkout, CheckoutResult, Subscription, BillingHistory } from '@/routes/billing'
import { MyReports } from '@/routes/reports'
import { StudioLibrary, StudioUpload, StudioEdit, StudioAnalytics } from '@/routes/studio'
import { CampaignList, CampaignNew, CampaignDetail, CampaignPerformance } from '@/routes/campaigns'
import { SupportQueue, ComplaintDetail, ComplaintHistory } from '@/routes/support'
import {
  AdminDashboard, AdminAccounts, AdminRoles, AdminModeration, AdminPlans,
  AdminRefunds, AdminAnnouncements, AdminLogs, AdminSettings,
} from '@/routes/admin'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <ToastHost>
          <ScrollToTop />
          <Routes>
            {/* front of house */}
            <Route path="/" element={<Lobby />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />

            <Route path="/browse" element={<Browse />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/category/:name" element={<Category />} />
            <Route path="/watch/:id" element={<Watch />} />
            <Route
              element={
                <RequireRole
                  allow={['viewer', 'creator', 'marketing', 'support', 'admin']}
                  console="Your account"
                >
                  <Outlet />
                </RequireRole>
              }
            >
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/history" element={<History />} />
              <Route path="/for-you" element={<ForYou />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings/notifications" element={<NotificationPrefs />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="/help" element={<Help />} />

            {/* subscription & payment */}
            <Route path="/plans" element={<Plans />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/result" element={<CheckoutResult />} />
            <Route
              element={
                <RequireRole
                  allow={['viewer', 'creator', 'marketing', 'support', 'admin']}
                  console="Your pass and reports"
                >
                  <Outlet />
                </RequireRole>
              }
            >
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/billing" element={<BillingHistory />} />
              <Route path="/reports" element={<MyReports />} />
            </Route>

            {/* creator studio */}
            <Route element={<RequireRole allow={['creator', 'admin']} console="Creator Studio"><Outlet /></RequireRole>}>
              <Route path="/studio" element={<StudioLibrary />} />
              <Route path="/studio/upload" element={<StudioUpload />} />
              <Route path="/studio/video/:id" element={<StudioEdit />} />
              <Route path="/studio/analytics" element={<StudioAnalytics />} />
            </Route>

            {/* advertising */}
            <Route element={<RequireRole allow={['marketing', 'admin']} console="The Box Office"><Outlet /></RequireRole>}>
              <Route path="/campaigns" element={<CampaignList />} />
              <Route path="/campaigns/new" element={<CampaignNew />} />
              <Route path="/campaigns/performance" element={<CampaignPerformance />} />
              <Route path="/campaigns/:id" element={<CampaignDetail />} />
            </Route>

            {/* support */}
            <Route element={<RequireRole allow={['support', 'admin']} console="The House Log"><Outlet /></RequireRole>}>
              <Route path="/queue" element={<SupportQueue />} />
              <Route path="/queue/history" element={<ComplaintHistory />} />
              <Route path="/queue/:id" element={<ComplaintDetail />} />
            </Route>

            {/* administration */}
            <Route element={<RequireRole allow={['admin']} console="The Projection Booth"><Outlet /></RequireRole>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/accounts" element={<AdminAccounts />} />
              <Route path="/admin/roles" element={<AdminRoles />} />
              <Route path="/admin/moderation" element={<AdminModeration />} />
              <Route path="/admin/plans" element={<AdminPlans />} />
              <Route path="/admin/refunds" element={<AdminRefunds />} />
              <Route path="/admin/announcements" element={<AdminAnnouncements />} />
              <Route path="/admin/logs" element={<AdminLogs />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/browse" replace />} />
          </Routes>
        </ToastHost>
      </SessionProvider>
    </BrowserRouter>
  )
}
