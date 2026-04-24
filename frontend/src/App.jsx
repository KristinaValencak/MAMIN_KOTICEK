import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Box, Spinner } from "@chakra-ui/react";
import MainLayout from "./routes/MainLayout";
import Forum from "./components/Forum/Forum";
import ScrollToTop from "./components/ScrollToTop";
import { NewPostLegacyRedirect } from "./components/Forum/GlobalNewPostModal";
import { ListingDetailLegacyRedirect, ListingEditLegacyRedirect, ListingFormLegacyRedirect } from "./components/Marketplace/GlobalMarketplaceModals";

const Register = lazy(() => import("./components/Forum/Register"));
const Login = lazy(() => import("./components/Forum/Login"));
const Profile = lazy(() => import("./components/Forum/Profile"));
const AccountSettingsPage = lazy(() => import("./pages/AccountSettingsPage"));
const TermsOfService = lazy(() => import("./components/TermsOfService/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./components/PrivacyPolicy/PrivacyPolicy"));
const VerifyEmail = lazy(() => import("./components/Forum/VerifyEmail"));
const ForgotPassword = lazy(() => import("./components/Forum/Password/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/Forum/Password/ResetPassword"));
const PublicProfile = lazy(() => import("./components/PublicProfile/PublicProfile"));
const CookiesPolicy = lazy(() => import("./components/Cookies/CookiesPolicy"));
const About = lazy(() => import("./pages/About"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const TopMoms = lazy(() => import("./pages/TopMoms"));
const LeisureLanding = lazy(() => import("./components/Leisure/LeisureLanding"));
const MamaQuiz = lazy(() => import("./components/Leisure/games/mamaQuiz"));
const AgeQuiz = lazy(() => import("./components/Leisure/games/ageQuiz"));
const AskQuiz = lazy(() => import("./components/Leisure/games/askQuiz"));
const CatchPacifier = lazy(() => import("./components/Leisure/games/CatchPacifier"));
const ModerationPage = lazy(() => import("./components/Moderation/ModerationPage"));

function AppRouteFallback() {
  return (
    <Box flex="1" display="flex" alignItems="center" justifyContent="center" minH="50vh" w="100%">
      <Spinner color="pink.400" size="lg" thickness="3px" />
    </Box>
  );
}

export default function App() {
  return (
    <Box as="div" flex="1" display="flex" flexDirection="column" minH="100dvh" w="100%" maxW="100%">
      <ScrollToTop />
      <Box flex="1" display="flex" flexDirection="column" w="100%" minH="0">
        <Suspense fallback={<AppRouteFallback />}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Forum />} />
              <Route path="/o-nas" element={<About />} />
              <Route path="/pogoji-uporabe" element={<TermsOfService />} />
              <Route path="/politika-zasebnosti" element={<PrivacyPolicy />} />
              <Route path="/registracija" element={<Register />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/prijava" element={<Login />} />
              <Route path="/novo" element={<NewPostLegacyRedirect />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/nastavitve" element={<AccountSettingsPage />} />
              <Route path="/moderacija" element={<ModerationPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/user/:id" element={<PublicProfile />} />
              <Route path="/politika-piskotkov" element={<CookiesPolicy />} />
              <Route path="/dogodki/*" element={<Navigate to="/" replace />} />
              <Route path="/top-moms" element={<TopMoms />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/marketplace/new" element={<ListingFormLegacyRedirect />} />
              <Route path="/marketplace/:id/edit" element={<ListingEditLegacyRedirect />} />
              <Route path="/marketplace/:id" element={<ListingDetailLegacyRedirect />} />
              <Route path="/za-mamo" element={<LeisureLanding />} />
              <Route path="/za-mamo/kaksna-mama-si-danes" element={<MamaQuiz />} />
              <Route path="/za-mamo/ugani-starost-otroka" element={<AgeQuiz />} />
              <Route path="/za-mamo/kaj-bi-naredila" element={<AskQuiz />} />
              <Route path="/za-mamo/ujemi-dudo" element={<CatchPacifier />} />

              <Route path="/sprostitev-za-mamo" element={<Navigate to="/za-mamo" replace />} />
              <Route path="/sprostitev-za-mamo/kaksna-mama-si-danes" element={<Navigate to="/za-mamo/kaksna-mama-si-danes" replace />} />
              <Route path="/sprostitev-za-mamo/ugani-starost-otroka" element={<Navigate to="/za-mamo/ugani-starost-otroka" replace />} />
              <Route path="/sprostitev-za-mamo/kaj-bi-naredila" element={<Navigate to="/za-mamo/kaj-bi-naredila" replace />} />
              <Route path="/sprostitev-za-mamo/ujemi-dudo" element={<Navigate to="/za-mamo/ujemi-dudo" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </Box>
    </Box>
  );
}
