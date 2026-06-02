import SellerChatInbox from "@/components/marketplace/SellerChatInbox";
import OfficialShopPageHeader from "./OfficialShopPageHeader";
import { useOfficialShop } from "./OfficialShopProvider";

export default function OfficialShopMessages() {
  const { sellerId } = useOfficialShop();

  return (
    <div className="space-y-6">
      <OfficialShopPageHeader title="Messages" description="Buyer conversations for the official shop" />
      <SellerChatInbox sellerId={sellerId} />
    </div>
  );
}
