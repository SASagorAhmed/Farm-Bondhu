import { describe, expect, it } from "vitest";
import { parseDeliveryAddress, normalizeDeliveryAddressForDb } from "@/lib/deliveryAddress";

describe("parseDeliveryAddress", () => {
  it("parses structured jsonb object", () => {
    const addr = parseDeliveryAddress({
      recipientName: "Karim",
      phone: "01712345678",
      division: "Dhaka",
      district: "Gazipur",
      upazila: "Sreepur",
      area: "Ward 3",
      address: "House 12, Road 5",
      city: "Gazipur",
    });
    expect(addr.recipientName).toBe("Karim");
    expect(addr.division).toBe("Dhaka");
    expect(addr.address).toBe("House 12, Road 5");
  });

  it("parses legacy plain text", () => {
    const addr = parseDeliveryAddress("House 12, Sadar, Mymensingh");
    expect(addr.address).toBe("House 12, Sadar, Mymensingh");
  });

  it("parses JSON string", () => {
    const addr = parseDeliveryAddress(JSON.stringify({ recipientName: "Rina", phone: "01812345678", address: "Block B", city: "Dhaka" }));
    expect(addr.recipientName).toBe("Rina");
    expect(addr.address).toBe("Block B");
  });
});

describe("normalizeDeliveryAddressForDb", () => {
  it("trims and fills country default", () => {
    const normalized = normalizeDeliveryAddressForDb({
      recipientName: " Karim ",
      phone: " 01712345678 ",
      area: "",
      address: " Road 1 ",
      city: "Dhaka",
      division: " Dhaka ",
      district: " Dhaka ",
    });
    expect(normalized.recipientName).toBe("Karim");
    expect(normalized.country).toBe("Bangladesh");
    expect(normalized.division).toBe("Dhaka");
  });
});
