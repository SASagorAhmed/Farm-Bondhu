import { Outlet } from "react-router-dom";
import OfficialShopProvider from "./OfficialShopProvider";

export default function OfficialShopAdminLayout() {
  return (
    <OfficialShopProvider>
      <Outlet />
    </OfficialShopProvider>
  );
}
