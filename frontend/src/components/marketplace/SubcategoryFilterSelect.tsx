import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSubcategoriesForLane,
  type MarketplaceLane,
} from "@/lib/marketplaceCategories";

type Props = {
  lane: Exclude<MarketplaceLane, "all">;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
};

export default function SubcategoryFilterSelect({
  lane,
  value,
  onValueChange,
  className,
}: Props) {
  const subcategories = getSubcategoriesForLane(lane);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className ?? "w-[180px]"}>
        <SelectValue placeholder="All subcategories" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All subcategories</SelectItem>
        {subcategories.map((c) => (
          <SelectItem key={c.slug} value={c.slug}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
