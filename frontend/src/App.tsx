import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { ToastHost } from '@/components/primitives'
import {
  SessionProvider, RequireAuth, RequireChannel, RequireModerator, RequireStaff,
} from '@/components/Shell'

import { Lobby, Login, Signup, ResetPassword, Onboarding } from '@/routes/auth'
import {
  Browse, SearchPage, Category, Watch, Watchlist, History, ForYou,
  Notifications, NotificationPrefs, Profile, Help,
} from '@/routes/viewer'
import { Plans, Checkout, CheckoutResult, Subscription, BillingHistory } from '@/routes/billing'
import { MyReports } from '@/routes/reports'
import {
  StudioLibrary, StudioUpload, StudioEdit, StudioAnalytics,
  CreateChannel, ChannelModerators, ChannelSettings,
} from '@/routes/studio'
import { ModerationQueue, ModerationHistory } from '@/routes/moderate'
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
            {/* Anything that belongs to an account rather than to the programme. */}
            <Route element={<RequireAuth what="This"><Outlet /></RequireAuth>}>
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
            <Route element={<RequireAuth what="Your pass"><Outlet /></RequireAuth>}>
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/billing" element={<BillingHistory />} />
              <Route path="/reports" element={<MyReports />} />
            </Route>

            {/* Creator Studio. Creating a channel is self-service, so it sits
                outside the channel guard — that guard is what sends you here. */}
            <Route element={<RequireAuth what="Creating a channel"><Outlet /></RequireAuth>}>
              <Route path="/studio/create" element={<CreateChannel />} />
            </Route>
            <Route element={<RequireChannel><Outlet /></RequireChannel>}>
              <Route path="/studio" element={<StudioLibrary />} />
              <Route path="/studio/upload" element={<StudioUpload />} />
              <Route path="/studio/video/:id" element={<StudioEdit />} />
              <Route path="/studio/analytics" element={<StudioAnalytics />} />
              <Route path="/studio/moderators" element={<ChannelModerators />} />
              <Route path="/studio/channel" element={<ChannelSettings />} />
            </Route>

            {/* Channel-scoped moderation, granted by a channel owner. */}
            <Route element={<RequireModerator><Outlet /></RequireModerator>}>
              <Route path="/moderate" element={<ModerationQueue />} />
              <Route path="/moderate/history" element={<ModerationHistory />} />
            </Route>

            {/* advertising */}
            <Route element={<RequireStaff role="marketing"><Outlet /></RequireStaff>}>
              <Route path="/campaigns" element={<CampaignList />} />
              <Route path="/campaigns/new" element={<CampaignNew />} />
              <Route path="/campaigns/performance" element={<CampaignPerformance />} />
              <Route path="/campaigns/:id" element={<CampaignDetail />} />
            </Route>

            {/* support */}
            <Route element={<RequireStaff role="support"><Outlet /></RequireStaff>}>
              <Route path="/queue" element={<SupportQueue />} />
              <Route path="/queue/history" element={<ComplaintHistory />} />
              <Route path="/queue/:id" element={<ComplaintDetail />} />
            </Route>

            {/* administration */}
            <Route element={<RequireStaff role="admin"><Outlet /></RequireStaff>}>
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
