import type {
  Supplier,
  Branch,
  InventoryItem,
  Customer,
  Sale,
  Material,
  ItemType,
  ItemVariety,
  Gender,
  Occupation,
  CustomerBackground,
} from '../types';

// ─── Suppliers ───────────────────────────────────────────
export const suppliers: Supplier[] = [
  {
    id: 'SUP001', name: 'Chennai Gold House', location: 'Chennai', state: 'Tamil Nadu',
    contactPerson: 'Rajesh Kumar', phone: '+91-9876543210', email: 'rajesh@chennaigold.com',
    gstNumber: '33AABCU9603R1ZM', materials: ['Gold', 'Silver'],
    itemTypes: ['Chain', 'Bangle', 'Ring', 'Pendant'], avgDeliveryDays: 7, reliabilityScore: 9, isActive: true,
  },
  {
    id: 'SUP002', name: 'Mumbai Diamond Works', location: 'Mumbai', state: 'Maharashtra',
    contactPerson: 'Suresh Patel', phone: '+91-9876543211', email: 'suresh@mumbaidiamond.com',
    gstNumber: '27AAFCM2345R1ZK', materials: ['Diamond', 'Gold'],
    itemTypes: ['Ring', 'Necklace', 'Earring', 'Pendant'], avgDeliveryDays: 10, reliabilityScore: 8, isActive: true,
  },
  {
    id: 'SUP003', name: 'Kolkata Silver Crafts', location: 'Kolkata', state: 'West Bengal',
    contactPerson: 'Amit Roy', phone: '+91-9876543212', email: 'amit@kolSilver.com',
    gstNumber: '19AADCS1234R1ZP', materials: ['Silver'],
    itemTypes: ['Chain', 'Bracelet', 'Anklet', 'Bangle'], avgDeliveryDays: 5, reliabilityScore: 7, isActive: true,
  },
  {
    id: 'SUP004', name: 'Bangalore Fine Jewels', location: 'Bangalore', state: 'Karnataka',
    contactPerson: 'Lakshmi Nair', phone: '+91-9876543213', email: 'lakshmi@blorejewels.com',
    gstNumber: '29AAFCB5678R1ZL', materials: ['Gold', 'Diamond', 'Silver'],
    itemTypes: ['Chain', 'Bangle', 'Ring', 'Pendant', 'Bracelet', 'Necklace'], avgDeliveryDays: 8, reliabilityScore: 9, isActive: true,
  },
  {
    id: 'SUP005', name: 'Hyderabad Gold Palace', location: 'Hyderabad', state: 'Telangana',
    contactPerson: 'Venkat Rao', phone: '+91-9876543214', email: 'venkat@hydgold.com',
    gstNumber: '36AADCH9012R1ZN', materials: ['Gold', 'Diamond'],
    itemTypes: ['Necklace', 'Bangle', 'Earring', 'Ring'], avgDeliveryDays: 12, reliabilityScore: 6, isActive: true,
  },
  {
    id: 'SUP006', name: 'Jaipur Temple Ornaments', location: 'Jaipur', state: 'Rajasthan',
    contactPerson: 'Mohan Sharma', phone: '+91-9876543215', email: 'mohan@jaipurtemples.com',
    gstNumber: '08AADCT3456R1ZQ', materials: ['Gold', 'Silver'],
    itemTypes: ['Bangle', 'Nose Pin', 'Necklace', 'Anklet'], avgDeliveryDays: 9, reliabilityScore: 8, isActive: true,
  },
];

// ─── Branches ────────────────────────────────────────────
export const branches: Branch[] = [
  {
    id: 'BR001', name: 'Chennai - T. Nagar', city: 'Chennai', state: 'Tamil Nadu',
    address: '45, Pondy Bazaar, T. Nagar', phone: '+91-44-28123456',
    manager: 'Kumar Subramanian', monthlyTarget: 5000000,
  },
  {
    id: 'BR002', name: 'Mumbai - Bandra', city: 'Mumbai', state: 'Maharashtra',
    address: '12, Hill Road, Bandra West', phone: '+91-22-26456789',
    manager: 'Priya Desai', monthlyTarget: 7500000,
  },
  {
    id: 'BR003', name: 'Bangalore - Jayanagar', city: 'Bangalore', state: 'Karnataka',
    address: '78, 4th Block, Jayanagar', phone: '+91-80-41234567',
    manager: 'Anita Hegde', monthlyTarget: 4500000,
  },
  {
    id: 'BR004', name: 'Hyderabad - Banjara Hills', city: 'Hyderabad', state: 'Telangana',
    address: '23, Road No. 12, Banjara Hills', phone: '+91-40-23456789',
    manager: 'Ravi Reddy', monthlyTarget: 5500000,
  },
  {
    id: 'BR005', name: 'Kolkata - Park Street', city: 'Kolkata', state: 'West Bengal',
    address: '56, Park Street', phone: '+91-33-22345678',
    manager: 'Debashish Ghosh', monthlyTarget: 3500000,
  },
  {
    id: 'BR006', name: 'Jaipur - MI Road', city: 'Jaipur', state: 'Rajasthan',
    address: '89, MI Road', phone: '+91-141-2345678',
    manager: 'Sunita Agarwal', monthlyTarget: 3000000,
  },
];

// ─── Helper ──────────────────────────────────────────────
let itemCounter = 100;
const genId = () => `ITM${++itemCounter}`;

const designs: Record<ItemType, string[]> = {
  Chain: ['Classic Link', 'Woven Pattern', 'Twisted Rope', 'Diamond Cut', 'Matte Finish', 'Glossy'],
  Bangle: ['Traditional Temple', 'Modern Minimal', 'Floral Engraved', 'Stone Studded', 'Filigree Work', 'Kundan Inlay'],
  Ring: ['Solitaire Classic', 'Double Band', 'Vintage Filigree', 'Stone Cluster', 'Plain Gold', 'Enamel Work'],
  Pendant: ['Lotus Motif', 'Peacock Design', 'Cross Pendant', 'Heart Shape', 'Geometric', 'Religious Symbol'],
  Bracelet: ['Charm Bracelet', 'Tennis Bracelet', 'Chain Link', 'Cuff Style', 'Beaded Design', 'Wrap Around'],
  Necklace: ['Choker Style', 'Long Haram', 'Choker with Pendant', 'Layered Chain', 'Statement Piece', 'Minimal Strand'],
  Earring: ['Jhumka Classic', 'Stud Elegant', 'Drop Chandelier', 'Hoop Modern', 'Threader', 'Cluster Diamond'],
  Anklet: ['Traditional Payal', 'Modern Chain', 'Bell Anklet', 'Diamond Studded', 'Silver Classic', 'Temple Design'],
  'Nose Pin': ['Gold Stud', 'Diamond Nosepin', 'Traditional Nath', 'Minimal Hoop', 'Stone Cluster', 'Floral Design'],
};

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split('T')[0];
}

// ─── Inventory Items ─────────────────────────────────────
function generateItems(): InventoryItem[] {
  const items: InventoryItem[] = [];
  const materialWeights: Record<Material, number[]> = {
    Gold: [5, 8, 10, 12, 16, 20, 25, 30, 40, 50, 80],
    Silver: [10, 15, 20, 25, 30, 40, 50, 75, 100],
    Diamond: [1, 2, 3, 5, 8, 10, 15, 20, 25, 30, 50],
  };
  const purities: Record<Material, string[]> = {
    Gold: ['22K', '18K', '24K', '14K'],
    Silver: ['925', '999', 'Oxidised'],
    Diamond: ['VS1', 'VS2', 'VVS1', 'VVS2', 'IF'],
  };

  const varieties: Record<ItemType, ItemVariety[]> = {
    Chain: ['Machine Cut', 'Bombay', 'Twin String', 'Singapore', 'Figaro', 'Rope', 'Curb', 'Box'],
    Bangle: ['Plain', 'Kundan', 'Polki', 'Temple', 'Bridal', 'American Diamond', 'Filigree', 'Enamelled'],
    Ring: ['Solitaire', 'Band', 'Signet', 'Cocktail', 'Eternity', 'Stackable', 'Beaded', 'Engraved'],
    Pendant: ['Locket', 'Charm', 'Drop', 'Statement', 'Cross', 'Initial', 'Gemstone', 'Religious'],
    Bracelet: ['Bangle Style', 'Chain Link', 'Charm', 'Cuff', 'Tennis', 'Wrap', 'Beaded', 'Slap'],
    Necklace: ['Locket', 'Charm', 'Drop', 'Statement', 'Cross', 'Initial'],
    Earring: ['Locket', 'Charm', 'Drop', 'Statement', 'Gemstone', 'Religious'],
    Anklet: ['Plain', 'Kundan', 'Temple', 'Filigree', 'Enamelled'],
    'Nose Pin': ['Locket', 'Charm', 'Drop', 'Gemstone'],
  };

  const itemNames: Record<ItemType, string[]> = {
    Chain: ['Gold Chain', 'Silver Chain'],
    Bangle: ['Gold Bangle', 'Silver Bangle'],
    Ring: ['Gold Ring', 'Diamond Ring', 'Silver Ring'],
    Pendant: ['Gold Pendant', 'Diamond Pendant', 'Silver Pendant'],
    Bracelet: ['Gold Bracelet', 'Silver Bracelet', 'Diamond Bracelet'],
    Necklace: ['Gold Necklace', 'Diamond Necklace'],
    Earring: ['Gold Earring', 'Diamond Earring', 'Silver Earring'],
    Anklet: ['Gold Anklet', 'Silver Anklet'],
    'Nose Pin': ['Gold Nose Pin', 'Diamond Nose Pin'],
  };

  const today = new Date();
  const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);

  for (const branch of branches) {
    // Pick 3-4 suppliers per branch
    const branchSuppliers = suppliers.filter(s => {
      if (branch.city === 'Chennai') return ['SUP001', 'SUP004'].includes(s.id);
      if (branch.city === 'Mumbai') return ['SUP002', 'SUP004'].includes(s.id);
      if (branch.city === 'Bangalore') return ['SUP004', 'SUP001'].includes(s.id);
      if (branch.city === 'Hyderabad') return ['SUP005', 'SUP002'].includes(s.id);
      if (branch.city === 'Kolkata') return ['SUP003', 'SUP001'].includes(s.id);
      return ['SUP006', 'SUP001'].includes(s.id);
    });

    for (const supplier of branchSuppliers) {
      const relevantMaterials = supplier.materials;

      for (const material of relevantMaterials) {
        // Pick 3-5 item types for this supplier
        const relevantTypes = supplier.itemTypes.slice(0, 4);

        for (const itemType of relevantTypes) {
          const itemVarieties = varieties[itemType];
          const itemDesigns = designs[itemType];
          const weights = materialWeights[material];
          const pur = purities[material];

          // Generate 3-6 variants per item type
          const numVariants = 3 + Math.floor(Math.random() * 4);
          const usedVarieties = new Set<string>();

          for (let v = 0; v < numVariants; v++) {
            let variety: ItemVariety;
            do {
              variety = itemVarieties[Math.floor(Math.random() * itemVarieties.length)];
            } while (usedVarieties.has(variety) && usedVarieties.size < itemVarieties.length);
            usedVarieties.add(variety);

            const weight = weights[Math.floor(Math.random() * weights.length)];
            const purity = pur[Math.floor(Math.random() * pur.length)];
            const design = itemDesigns[Math.floor(Math.random() * itemDesigns.length)];
            const itemName = itemNames[itemType][Math.floor(Math.random() * itemNames[itemType].length)];

            // Pricing
            const basePricePerGram = material === 'Gold' ? 6200 : material === 'Diamond' ? 15000 : 80;
            const makingCharge = 1.15 + Math.random() * 0.25;
            const costPrice = Math.round(weight * basePricePerGram * makingCharge);
            const sellingPrice = Math.round(costPrice * (1.12 + Math.random() * 0.15));

            // Determine if sold
            const isSold = Math.random() > 0.45;
            const receivedDate = randomDate(sixMonthsAgo, today);
            const soldDate = isSold
              ? (() => {
                  const sold = new Date(new Date(receivedDate).getTime() + (5 + Math.random() * 90) * 24 * 60 * 60 * 1000);
                  return sold > today ? null : sold.toISOString().split('T')[0];
                })()
              : null;
            const actualSoldDate = soldDate || (isSold ? null : null);

            const qty = 1 + Math.floor(Math.random() * 15);
            const avgMonthlySales = Math.round((1 + Math.random() * 12) * 10) / 10;
            const leadDays = supplier.avgDeliveryDays + Math.floor(Math.random() * 5);

            items.push({
              id: genId(),
              sku: `${itemType.substring(0, 3).toUpperCase()}-${material.substring(0, 1)}${weight}G-${variety.substring(0, 3).toUpperCase()}-${branch.id}`,
              name: `${itemName} - ${variety}`,
              material,
              itemType,
              variety,
              design,
              weightGrams: weight,
              purity,
              supplierId: supplier.id,
              branchId: branch.id,
              costPrice,
              sellingPrice,
              imageUrl: '',
              receivedDate,
              soldDate: actualSoldDate,
              status: actualSoldDate ? 'Sold' : (Math.random() > 0.9 ? 'Reserved' : 'In Stock'),
              quantity: qty,
              minStockLevel: Math.ceil(avgMonthlySales / 2),
              reorderLeadDays: leadDays,
              avgMonthlySales,
              notes: '',
            });
          }
        }
      }
    }
  }
  return items;
}

export const inventoryItems = generateItems();

// ─── Customers ───────────────────────────────────────────
const nameFirst = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Arnav', 'Ayaan', 'Krishna', 'Ishaan',
  'Aanya', 'Aadhya', 'Ananya', 'Pari', 'Anika', 'Diya', 'Myra', 'Saanvi', 'Aarohi', 'Riya',
  'Priya', 'Deepa', 'Sunita', 'Lakshmi', 'Kavitha', 'Meera', 'Pooja', 'Neha', 'Sneha', 'Ritu'];
const nameLast = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Nair', 'Iyer', 'Gupta', 'Joshi', 'Rao',
  'Desai', 'Menon', 'Pillai', 'Agarwal', 'Mehta', 'Chopra', 'Verma', 'Bhatt', 'Mishra', 'Banerjee'];

export const customers: Customer[] = Array.from({ length: 120 }, (_, i) => {
  const age = 20 + Math.floor(Math.random() * 40);
  const ageGroup: Customer['ageGroup'] =
    age <= 25 ? '18-25' : age <= 35 ? '26-35' : age <= 45 ? '36-45' : age <= 55 ? '46-55' : '55+';
  const gender: Gender = Math.random() > 0.5 ? 'Female' : Math.random() > 0.6 ? 'Male' : 'Unisex';
  const occupations: Occupation[] = ['Business', 'Professional', 'Agriculture', 'Government', 'Homemaker', 'Student', 'Retired', 'Other'];
  const backgrounds: CustomerBackground[] = ['Urban', 'Semi-Urban', 'Rural'];
  const cities = ['Chennai', 'Mumbai', 'Bangalore', 'Hyderabad', 'Kolkata', 'Jaipur'];

  return {
    id: `CUST${String(i + 1).padStart(4, '0')}`,
    name: `${nameFirst[Math.floor(Math.random() * nameFirst.length)]} ${nameLast[Math.floor(Math.random() * nameLast.length)]}`,
    age,
    ageGroup,
    gender,
    occupation: occupations[Math.floor(Math.random() * occupations.length)],
    background: backgrounds[Math.floor(Math.random() * backgrounds.length)],
    phone: `+91-${9000000000 + Math.floor(Math.random() * 999999999)}`,
    city: cities[Math.floor(Math.random() * cities.length)],
    totalPurchases: 1 + Math.floor(Math.random() * 15),
    totalSpent: Math.round((5000 + Math.random() * 200000) * 100) / 100,
  };
});

// ─── Sales ───────────────────────────────────────────────
export function generateSales(items: InventoryItem[]): Sale[] {
  const soldItems = items.filter(it => it.status === 'Sold');
  const payments: Sale['paymentMethod'][] = ['Cash', 'Card', 'UPI', 'Bank Transfer'];

  return soldItems.map((item, i) => ({
    id: `SALE${String(i + 1).padStart(5, '0')}`,
    itemId: item.id,
    customerId: customers[Math.floor(Math.random() * customers.length)].id,
    branchId: item.branchId,
    saleDate: item.soldDate!,
    quantity: item.quantity,
    salePrice: item.sellingPrice,
    costPrice: item.costPrice,
    discount: Math.random() > 0.7 ? Math.round(Math.random() * 5 * 100) / 100 : 0,
    paymentMethod: payments[Math.floor(Math.random() * payments.length)],
  }));
}

export const sales = generateSales(inventoryItems);
