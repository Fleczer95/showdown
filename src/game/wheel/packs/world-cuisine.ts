// Premium pack: World Cuisine — The Wheel.
// 60 original bilingual (EN/PL) puzzles. Phrases are generic, public-domain
// food names (dishes, desserts, ingredients, cooking terms) in UPPERCASE — no
// brands, no copyrighted material. Derived monolingual arrays feed
// PackDefinition.content; the store bridge picks puzzles by locale at runtime.

import type { PuzzleContent } from '../logic';

interface BiPuzzle {
    id: string;
    phrase: { en: string; pl: string };
    category: { en: string; pl: string };
}

const DISH = { en: 'Dish', pl: 'Danie' };
const SOUP = { en: 'Soup', pl: 'Zupa' };
const DESSERT = { en: 'Dessert', pl: 'Deser' };
const INGREDIENT = { en: 'Ingredient', pl: 'Składnik' };
const SPICE = { en: 'Spice', pl: 'Przyprawa' };
const BREAD = { en: 'Bread', pl: 'Pieczywo' };
const CHEESE = { en: 'Cheese', pl: 'Ser' };
const BEVERAGE = { en: 'Beverage', pl: 'Napój' };
const CUISINE = { en: 'Cuisine', pl: 'Kuchnia' };
const COOKING = { en: 'Cooking term', pl: 'Termin kulinarny' };

const puzzles: BiPuzzle[] = [
    // --- Dishes ---
    { id: 'wheel-world-cuisine-001', phrase: { en: 'SPAGHETTI BOLOGNESE', pl: 'SPAGHETTI BOLOGNESE' }, category: DISH },
    { id: 'wheel-world-cuisine-002', phrase: { en: 'CHICKEN TIKKA MASALA', pl: 'KURCZAK TIKKA MASALA' }, category: DISH },
    { id: 'wheel-world-cuisine-003', phrase: { en: 'BEEF WELLINGTON', pl: 'POLĘDWICA WELLINGTON' }, category: DISH },
    { id: 'wheel-world-cuisine-004', phrase: { en: 'PAD THAI NOODLES', pl: 'MAKARON PAD THAI' }, category: DISH },
    { id: 'wheel-world-cuisine-005', phrase: { en: 'FRESH SUSHI ROLL', pl: 'ŚWIEŻE MAKI SUSHI' }, category: DISH },
    { id: 'wheel-world-cuisine-006', phrase: { en: 'MARGHERITA PIZZA', pl: 'PIZZA MARGHERITA' }, category: DISH },
    { id: 'wheel-world-cuisine-007', phrase: { en: 'FISH AND CHIPS', pl: 'RYBA Z FRYTKAMI' }, category: DISH },
    { id: 'wheel-world-cuisine-008', phrase: { en: 'CAESAR SALAD', pl: 'SAŁATKA CEZAR' }, category: DISH },
    { id: 'wheel-world-cuisine-009', phrase: { en: 'GREEK SALAD', pl: 'SAŁATKA GRECKA' }, category: DISH },
    { id: 'wheel-world-cuisine-010', phrase: { en: 'PAELLA VALENCIANA', pl: 'PAELLA WALENCJAŃSKA' }, category: DISH },
    { id: 'wheel-world-cuisine-011', phrase: { en: 'WIENER SCHNITZEL', pl: 'SZNYCEL WIEDEŃSKI' }, category: DISH },
    { id: 'wheel-world-cuisine-012', phrase: { en: 'BEEF STROGANOFF', pl: 'STROGONOW WOŁOWY' }, category: DISH },
    { id: 'wheel-world-cuisine-013', phrase: { en: 'CHICKEN CURRY', pl: 'CURRY Z KURCZAKA' }, category: DISH },
    { id: 'wheel-world-cuisine-014', phrase: { en: 'GRILLED SALMON FILLET', pl: 'GRILLOWANY FILET Z ŁOSOSIA' }, category: DISH },
    { id: 'wheel-world-cuisine-015', phrase: { en: 'STUFFED BELL PEPPERS', pl: 'FASZEROWANA PAPRYKA' }, category: DISH },

    // --- Soups ---
    { id: 'wheel-world-cuisine-016', phrase: { en: 'FRENCH ONION SOUP', pl: 'FRANCUSKA ZUPA CEBULOWA' }, category: SOUP },
    { id: 'wheel-world-cuisine-017', phrase: { en: 'MISO SOUP', pl: 'ZUPA MISO' }, category: SOUP },
    { id: 'wheel-world-cuisine-018', phrase: { en: 'CREAMY TOMATO SOUP', pl: 'KREMOWA ZUPA POMIDOROWA' }, category: SOUP },
    { id: 'wheel-world-cuisine-019', phrase: { en: 'ROASTED PUMPKIN SOUP', pl: 'ZUPA Z PIECZONEJ DYNI' }, category: SOUP },
    { id: 'wheel-world-cuisine-020', phrase: { en: 'CHICKEN NOODLE SOUP', pl: 'ROSÓŁ Z MAKARONEM' }, category: SOUP },

    // --- Desserts ---
    { id: 'wheel-world-cuisine-021', phrase: { en: 'CHOCOLATE MOUSSE', pl: 'MUS CZEKOLADOWY' }, category: DESSERT },
    { id: 'wheel-world-cuisine-022', phrase: { en: 'CREME BRULEE', pl: 'CREME BRULEE' }, category: DESSERT },
    { id: 'wheel-world-cuisine-023', phrase: { en: 'TIRAMISU CAKE', pl: 'CIASTO TIRAMISU' }, category: DESSERT },
    { id: 'wheel-world-cuisine-024', phrase: { en: 'LEMON CHEESECAKE', pl: 'SERNIK CYTRYNOWY' }, category: DESSERT },
    { id: 'wheel-world-cuisine-025', phrase: { en: 'VANILLA ICE CREAM', pl: 'LODY WANILIOWE' }, category: DESSERT },
    { id: 'wheel-world-cuisine-026', phrase: { en: 'RICE PUDDING', pl: 'RYŻ NA MLEKU' }, category: DESSERT },
    { id: 'wheel-world-cuisine-027', phrase: { en: 'CHOCOLATE FONDUE', pl: 'FONDUE CZEKOLADOWE' }, category: DESSERT },
    { id: 'wheel-world-cuisine-028', phrase: { en: 'STRAWBERRY SHORTCAKE', pl: 'TORT TRUSKAWKOWY' }, category: DESSERT },
    { id: 'wheel-world-cuisine-029', phrase: { en: 'WARM BANANA BREAD', pl: 'CIEPŁY CHLEB BANANOWY' }, category: DESSERT },
    { id: 'wheel-world-cuisine-030', phrase: { en: 'HONEY GLAZED DONUT', pl: 'PĄCZEK W POLEWIE MIODOWEJ' }, category: DESSERT },

    // --- Ingredients ---
    { id: 'wheel-world-cuisine-031', phrase: { en: 'EXTRA VIRGIN OLIVE OIL', pl: 'OLIWA Z PIERWSZEGO TŁOCZENIA' }, category: INGREDIENT },
    { id: 'wheel-world-cuisine-032', phrase: { en: 'COARSE SEA SALT', pl: 'GRUBA SÓL MORSKA' }, category: INGREDIENT },
    { id: 'wheel-world-cuisine-033', phrase: { en: 'FRESH BASIL LEAVES', pl: 'ŚWIEŻE LISTKI BAZYLII' }, category: INGREDIENT },
    { id: 'wheel-world-cuisine-034', phrase: { en: 'GARLIC CLOVES', pl: 'ZĄBKI CZOSNKU' }, category: INGREDIENT },
    { id: 'wheel-world-cuisine-035', phrase: { en: 'RIPE CHERRY TOMATOES', pl: 'DOJRZAŁE POMIDORKI KOKTAJLOWE' }, category: INGREDIENT },
    { id: 'wheel-world-cuisine-036', phrase: { en: 'WILD FOREST MUSHROOMS', pl: 'DZIKIE LEŚNE GRZYBY' }, category: INGREDIENT },

    // --- Spices ---
    { id: 'wheel-world-cuisine-037', phrase: { en: 'FRESHLY GROUND BLACK PEPPER', pl: 'ŚWIEŻO MIELONY CZARNY PIEPRZ' }, category: SPICE },
    { id: 'wheel-world-cuisine-038', phrase: { en: 'GROUND CINNAMON', pl: 'MIELONY CYNAMON' }, category: SPICE },
    { id: 'wheel-world-cuisine-039', phrase: { en: 'SAFFRON THREADS', pl: 'NITKI SZAFRANU' }, category: SPICE },
    { id: 'wheel-world-cuisine-040', phrase: { en: 'SMOKED PAPRIKA', pl: 'WĘDZONA PAPRYKA' }, category: SPICE },

    // --- Breads ---
    { id: 'wheel-world-cuisine-041', phrase: { en: 'SOURDOUGH BREAD', pl: 'CHLEB NA ZAKWASIE' }, category: BREAD },
    { id: 'wheel-world-cuisine-042', phrase: { en: 'FRENCH BAGUETTE', pl: 'FRANCUSKA BAGIETKA' }, category: BREAD },
    { id: 'wheel-world-cuisine-043', phrase: { en: 'WARM GARLIC NAAN', pl: 'CIEPŁY CHLEBEK NAAN' }, category: BREAD },
    { id: 'wheel-world-cuisine-044', phrase: { en: 'CORN TORTILLA', pl: 'TORTILLA KUKURYDZIANA' }, category: BREAD },
    { id: 'wheel-world-cuisine-045', phrase: { en: 'ITALIAN CIABATTA', pl: 'WŁOSKA CIABATTA' }, category: BREAD },

    // --- Cheeses ---
    { id: 'wheel-world-cuisine-046', phrase: { en: 'AGED CHEDDAR', pl: 'DOJRZEWAJĄCY CHEDDAR' }, category: CHEESE },
    { id: 'wheel-world-cuisine-047', phrase: { en: 'FRESH MOZZARELLA', pl: 'ŚWIEŻA MOZZARELLA' }, category: CHEESE },
    { id: 'wheel-world-cuisine-048', phrase: { en: 'CREAMY BLUE CHEESE', pl: 'KREMOWY SER PLEŚNIOWY' }, category: CHEESE },
    { id: 'wheel-world-cuisine-049', phrase: { en: 'SOFT GOAT CHEESE', pl: 'MIĘKKI SER KOZI' }, category: CHEESE },
    { id: 'wheel-world-cuisine-050', phrase: { en: 'GRATED PARMESAN', pl: 'TARTY PARMEZAN' }, category: CHEESE },

    // --- Beverages ---
    { id: 'wheel-world-cuisine-051', phrase: { en: 'HOT GREEN TEA', pl: 'GORĄCA ZIELONA HERBATA' }, category: BEVERAGE },
    { id: 'wheel-world-cuisine-052', phrase: { en: 'STRONG BLACK COFFEE', pl: 'MOCNA CZARNA KAWA' }, category: BEVERAGE },
    { id: 'wheel-world-cuisine-053', phrase: { en: 'FRESH LEMONADE', pl: 'ŚWIEŻA LEMONIADA' }, category: BEVERAGE },
    { id: 'wheel-world-cuisine-054', phrase: { en: 'RICH HOT CHOCOLATE', pl: 'GĘSTA GORĄCA CZEKOLADA' }, category: BEVERAGE },
    { id: 'wheel-world-cuisine-055', phrase: { en: 'FRESH ORANGE JUICE', pl: 'ŚWIEŻY SOK POMARAŃCZOWY' }, category: BEVERAGE },

    // --- Cuisines ---
    { id: 'wheel-world-cuisine-056', phrase: { en: 'ITALIAN CUISINE', pl: 'KUCHNIA WŁOSKA' }, category: CUISINE },
    { id: 'wheel-world-cuisine-057', phrase: { en: 'JAPANESE CUISINE', pl: 'KUCHNIA JAPOŃSKA' }, category: CUISINE },
    { id: 'wheel-world-cuisine-058', phrase: { en: 'MEXICAN CUISINE', pl: 'KUCHNIA MEKSYKAŃSKA' }, category: CUISINE },

    // --- Cooking terms ---
    { id: 'wheel-world-cuisine-059', phrase: { en: 'SIMMER ON LOW HEAT', pl: 'GOTUJ NA WOLNYM OGNIU' }, category: COOKING },
    { id: 'wheel-world-cuisine-060', phrase: { en: 'KNEAD THE FRESH DOUGH', pl: 'ZAGNIATAJ ŚWIEŻE CIASTO' }, category: COOKING },
];

const toLocale =
    (lang: 'en' | 'pl') =>
    (p: BiPuzzle): PuzzleContent => ({
        id: p.id,
        phrase: p.phrase[lang],
        category: p.category[lang],
    });

export const worldCuisineEn: PuzzleContent[] = puzzles.map(toLocale('en'));
export const worldCuisinePl: PuzzleContent[] = puzzles.map(toLocale('pl'));
