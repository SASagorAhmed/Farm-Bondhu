import { useAuth } from "@/contexts/AuthContext";
import FarmLayout from "./FarmLayout";
import BuyerLayout from "./BuyerLayout";
import VendorLayout from "./VendorLayout";
import VetLayout from "./VetLayout";
import DashboardLayout from "./DashboardLayout";

export default function ProfileLayoutWrapper() {
  const { user } = useAuth();
  const role = user?.primaryRole;

  switch (role) {
    case "farmer":
      return <FarmLayout />;
    case "vendor":
      return <VendorLayout />;
    case "vet":
      return <VetLayout />;
    case "admin":
      return <DashboardLayout />;
    default:
      return <BuyerLayout />;
  }
}
