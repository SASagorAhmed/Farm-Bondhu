import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import MarketplaceSection from "@/components/landing/MarketplaceSection";
import MediBondhuSection from "@/components/landing/MediBondhuSection";
import AnimalsSection from "@/components/landing/AnimalsSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import TrustBar from "@/components/landing/TrustBar";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <MarketplaceSection />
      <MediBondhuSection />
      <AnimalsSection />
      <HowItWorksSection />
      <TrustBar />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
