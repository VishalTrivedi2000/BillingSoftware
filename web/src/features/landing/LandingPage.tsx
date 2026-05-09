import { LandingNavbar } from './LandingNavbar';
import { LandingHero } from './LandingHero';
import { LandingFeatures } from './LandingFeatures';
import { LandingHowItWorks } from './LandingHowItWorks';
import { LandingShipsToday } from './LandingShipsToday';
import { LandingDatabase } from './LandingDatabase';
import { LandingCTA } from './LandingCTA';
import { LandingFooter } from './LandingFooter';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      <LandingNavbar />
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingShipsToday />
      <LandingDatabase />
      <LandingCTA />
      <LandingFooter />
    </div>
  );
}
