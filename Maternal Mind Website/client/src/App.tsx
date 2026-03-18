import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import { Layout } from "@/components/layout";
import { LoadingScreen } from "@/components/loading-screen";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Features from "@/pages/features";
import HowItWorks from "@/pages/how-it-works";
import Pricing from "@/pages/pricing";
import Institutions from "@/pages/institutions";
import About from "@/pages/about";
import Support from "@/pages/support";
import LegalHub, {
  TermsPage,
  PrivacyPage,
  DisclaimerPage,
} from "@/pages/legal";
import DeleteAccount from "@/pages/delete-account";
import { ResourcesHub, ResourcePage } from "@/pages/resources";
import Media from "@/pages/media";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/features" component={Features} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/institutions" component={Institutions} />
        <Route path="/about" component={About} />
        <Route path="/support" component={Support} />
        <Route path="/legal" component={LegalHub} />
        <Route path="/legal/terms" component={TermsPage} />
        <Route path="/legal/privacy" component={PrivacyPage} />
        <Route path="/legal/disclaimer" component={DisclaimerPage} />
        <Route path="/delete-account" component={DeleteAccount} />
        <Route path="/resources" component={ResourcesHub} />
        <Route path="/resources/:slug">
          {(params) => <ResourcePage slug={params.slug} />}
        </Route>
        <Route path="/media" component={Media} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LoadingScreen />
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
