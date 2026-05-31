// Bilingual question bank for "The Ladder".
// Organised as 15 rungs of increasing difficulty; each rung holds at least two
// questions (one shown + alternates the Skip lifeline can swap to).

export type Localized = { en: string; pl: string };

export interface ContentQuestion {
    /** Stable id, unique within this game. Flows into the run for history. */
    id: string;
    question: Localized;
    /** Four answer options; index 0 is always the correct answer here. */
    options: [Localized, Localized, Localized, Localized];
    hint: Localized;
}

export interface ContentPack {
    id: string;
    name: Localized;
    /** rungs[i] = every question available for rung i (>= 2). */
    rungs: ContentQuestion[][];
}

const RUNGS: ContentQuestion[][] = [
    // Rung 1
    [
        {
            id: 'ladder-001',
            question: { en: 'How many legs does a spider have?', pl: 'Ile nóg ma pająk?' },
            options: [
                { en: '8', pl: '8' },
                { en: '6', pl: '6' },
                { en: '10', pl: '10' },
                { en: '4', pl: '4' },
            ],
            hint: { en: 'More than an insect.', pl: 'Więcej niż owad.' },
        },
        {
            id: 'ladder-002',
            question: { en: 'How many days are there in a week?', pl: 'Ile dni ma tydzień?' },
            options: [
                { en: '7', pl: '7' },
                { en: '5', pl: '5' },
                { en: '10', pl: '10' },
                { en: '12', pl: '12' },
            ],
            hint: { en: 'One for each day from Monday to Sunday.', pl: 'Po jednym od poniedziałku do niedzieli.' },
        },
    ],
    // Rung 2
    [
        {
            id: 'ladder-003',
            question: { en: 'What colour do you get by mixing blue and yellow?', pl: 'Jaki kolor powstaje z połączenia niebieskiego i żółtego?' },
            options: [
                { en: 'Green', pl: 'Zielony' },
                { en: 'Purple', pl: 'Fioletowy' },
                { en: 'Orange', pl: 'Pomarańczowy' },
                { en: 'Brown', pl: 'Brązowy' },
            ],
            hint: { en: 'The colour of grass.', pl: 'Kolor trawy.' },
        },
        {
            id: 'ladder-004',
            question: { en: 'How many colours are in a rainbow?', pl: 'Ile kolorów ma tęcza?' },
            options: [
                { en: '7', pl: '7' },
                { en: '5', pl: '5' },
                { en: '6', pl: '6' },
                { en: '9', pl: '9' },
            ],
            hint: { en: 'Red, orange, yellow, green, blue, indigo, violet.', pl: 'Czerwony, pomarańczowy, żółty, zielony, niebieski, indygo, fioletowy.' },
        },
    ],
    // Rung 3
    [
        {
            id: 'ladder-005',
            question: { en: 'Which animal is known as the "King of the Jungle"?', pl: 'Które zwierzę nazywane jest „królem dżungli”?' },
            options: [
                { en: 'Lion', pl: 'Lew' },
                { en: 'Tiger', pl: 'Tygrys' },
                { en: 'Elephant', pl: 'Słoń' },
                { en: 'Bear', pl: 'Niedźwiedź' },
            ],
            hint: { en: 'It has a mane.', pl: 'Ma grzywę.' },
        },
        {
            id: 'ladder-006',
            question: { en: 'What do bees produce?', pl: 'Co produkują pszczoły?' },
            options: [
                { en: 'Honey', pl: 'Miód' },
                { en: 'Milk', pl: 'Mleko' },
                { en: 'Silk', pl: 'Jedwab' },
                { en: 'Wax only', pl: 'Tylko wosk' },
            ],
            hint: { en: 'Sweet and golden.', pl: 'Słodki i złocisty.' },
        },
    ],
    // Rung 4
    [
        {
            id: 'ladder-007',
            question: { en: 'Which planet is known as the Red Planet?', pl: 'Która planeta nazywana jest Czerwoną Planetą?' },
            options: [
                { en: 'Mars', pl: 'Mars' },
                { en: 'Venus', pl: 'Wenus' },
                { en: 'Jupiter', pl: 'Jowisz' },
                { en: 'Saturn', pl: 'Saturn' },
            ],
            hint: { en: 'Named after the Roman god of war.', pl: 'Nazwana od rzymskiego boga wojny.' },
        },
        {
            id: 'ladder-008',
            question: { en: 'What is the closest planet to the Sun?', pl: 'Która planeta jest najbliżej Słońca?' },
            options: [
                { en: 'Mercury', pl: 'Merkury' },
                { en: 'Venus', pl: 'Wenus' },
                { en: 'Earth', pl: 'Ziemia' },
                { en: 'Mars', pl: 'Mars' },
            ],
            hint: { en: 'The smallest planet in the Solar System.', pl: 'Najmniejsza planeta Układu Słonecznego.' },
        },
    ],
    // Rung 5
    [
        {
            id: 'ladder-009',
            question: { en: 'What is the largest mammal on Earth?', pl: 'Jaki jest największy ssak na Ziemi?' },
            options: [
                { en: 'Blue whale', pl: 'Płetwal błękitny' },
                { en: 'African elephant', pl: 'Słoń afrykański' },
                { en: 'Giraffe', pl: 'Żyrafa' },
                { en: 'Hippopotamus', pl: 'Hipopotam' },
            ],
            hint: { en: 'It lives in the ocean.', pl: 'Żyje w oceanie.' },
        },
        {
            id: 'ladder-010',
            question: { en: 'Which is the largest ocean on Earth?', pl: 'Który ocean jest największy na Ziemi?' },
            options: [
                { en: 'Pacific', pl: 'Spokojny' },
                { en: 'Atlantic', pl: 'Atlantycki' },
                { en: 'Indian', pl: 'Indyjski' },
                { en: 'Arctic', pl: 'Arktyczny' },
            ],
            hint: { en: 'It borders Asia and the Americas.', pl: 'Graniczy z Azją i obiema Amerykami.' },
        },
    ],
    // Rung 6
    [
        {
            id: 'ladder-011',
            question: { en: 'How many continents are there on Earth?', pl: 'Ile kontynentów jest na Ziemi?' },
            options: [
                { en: '7', pl: '7' },
                { en: '5', pl: '5' },
                { en: '6', pl: '6' },
                { en: '8', pl: '8' },
            ],
            hint: { en: 'Asia, Africa, Europe... and four more.', pl: 'Azja, Afryka, Europa... i jeszcze cztery.' },
        },
        {
            id: 'ladder-012',
            question: { en: 'On which continent is the Sahara Desert?', pl: 'Na którym kontynencie leży Sahara?' },
            options: [
                { en: 'Africa', pl: 'Afryka' },
                { en: 'Asia', pl: 'Azja' },
                { en: 'Australia', pl: 'Australia' },
                { en: 'South America', pl: 'Ameryka Południowa' },
            ],
            hint: { en: 'The same continent as Egypt.', pl: 'Ten sam kontynent co Egipt.' },
        },
    ],
    // Rung 7
    [
        {
            id: 'ladder-013',
            question: { en: 'Which gas do plants absorb from the air?', pl: 'Jaki gaz rośliny pobierają z powietrza?' },
            options: [
                { en: 'Carbon dioxide', pl: 'Dwutlenek węgla' },
                { en: 'Oxygen', pl: 'Tlen' },
                { en: 'Nitrogen', pl: 'Azot' },
                { en: 'Hydrogen', pl: 'Wodór' },
            ],
            hint: { en: 'The gas we breathe out.', pl: 'Gaz, który wydychamy.' },
        },
        {
            id: 'ladder-014',
            question: { en: 'What process do plants use to make food from sunlight?', pl: 'Jaki proces pozwala roślinom wytwarzać pokarm ze światła słonecznego?' },
            options: [
                { en: 'Photosynthesis', pl: 'Fotosynteza' },
                { en: 'Respiration', pl: 'Oddychanie' },
                { en: 'Digestion', pl: 'Trawienie' },
                { en: 'Evaporation', pl: 'Parowanie' },
            ],
            hint: { en: 'It happens in the leaves, using chlorophyll.', pl: 'Zachodzi w liściach, z udziałem chlorofilu.' },
        },
    ],
    // Rung 8
    [
        {
            id: 'ladder-015',
            question: { en: 'Who painted the Mona Lisa?', pl: 'Kto namalował Mona Lisę?' },
            options: [
                { en: 'Leonardo da Vinci', pl: 'Leonardo da Vinci' },
                { en: 'Pablo Picasso', pl: 'Pablo Picasso' },
                { en: 'Vincent van Gogh', pl: 'Vincent van Gogh' },
                { en: 'Michelangelo', pl: 'Michał Anioł' },
            ],
            hint: { en: 'An Italian Renaissance polymath.', pl: 'Włoski geniusz renesansu.' },
        },
        {
            id: 'ladder-016',
            question: { en: 'Who painted "The Starry Night"?', pl: 'Kto namalował „Gwiaździstą noc”?' },
            options: [
                { en: 'Vincent van Gogh', pl: 'Vincent van Gogh' },
                { en: 'Claude Monet', pl: 'Claude Monet' },
                { en: 'Salvador Dalí', pl: 'Salvador Dalí' },
                { en: 'Rembrandt', pl: 'Rembrandt' },
            ],
            hint: { en: 'A Dutch post-impressionist painter.', pl: 'Holenderski malarz postimpresjonista.' },
        },
    ],
    // Rung 9
    [
        {
            id: 'ladder-017',
            question: { en: 'What is the chemical symbol for gold?', pl: 'Jaki jest symbol chemiczny złota?' },
            options: [
                { en: 'Au', pl: 'Au' },
                { en: 'Gd', pl: 'Gd' },
                { en: 'Go', pl: 'Go' },
                { en: 'Ag', pl: 'Ag' },
            ],
            hint: { en: 'From the Latin word "aurum".', pl: 'Od łacińskiego słowa „aurum”.' },
        },
        {
            id: 'ladder-018',
            question: { en: 'What is the chemical symbol for sodium?', pl: 'Jaki jest symbol chemiczny sodu?' },
            options: [
                { en: 'Na', pl: 'Na' },
                { en: 'So', pl: 'So' },
                { en: 'Sd', pl: 'Sd' },
                { en: 'S', pl: 'S' },
            ],
            hint: { en: 'From the Latin word "natrium".', pl: 'Od łacińskiego słowa „natrium”.' },
        },
    ],
    // Rung 10
    [
        {
            id: 'ladder-019',
            question: { en: 'In which year did the Second World War end?', pl: 'W którym roku zakończyła się II wojna światowa?' },
            options: [
                { en: '1945', pl: '1945' },
                { en: '1939', pl: '1939' },
                { en: '1918', pl: '1918' },
                { en: '1950', pl: '1950' },
            ],
            hint: { en: 'The same decade the UN was founded.', pl: 'Ta sama dekada, w której powstało ONZ.' },
        },
        {
            id: 'ladder-020',
            question: { en: 'In which year did the First World War begin?', pl: 'W którym roku rozpoczęła się I wojna światowa?' },
            options: [
                { en: '1914', pl: '1914' },
                { en: '1912', pl: '1912' },
                { en: '1918', pl: '1918' },
                { en: '1920', pl: '1920' },
            ],
            hint: { en: 'It lasted until 1918.', pl: 'Trwała do 1918 roku.' },
        },
    ],
    // Rung 11
    [
        {
            id: 'ladder-021',
            question: { en: 'What is the capital city of Australia?', pl: 'Jaka jest stolica Australii?' },
            options: [
                { en: 'Canberra', pl: 'Canberra' },
                { en: 'Sydney', pl: 'Sydney' },
                { en: 'Melbourne', pl: 'Melbourne' },
                { en: 'Perth', pl: 'Perth' },
            ],
            hint: { en: 'Not the biggest city — a purpose-built capital.', pl: 'Nie największe miasto — stolica zbudowana celowo.' },
        },
        {
            id: 'ladder-022',
            question: { en: 'What is the capital city of Canada?', pl: 'Jaka jest stolica Kanady?' },
            options: [
                { en: 'Ottawa', pl: 'Ottawa' },
                { en: 'Toronto', pl: 'Toronto' },
                { en: 'Vancouver', pl: 'Vancouver' },
                { en: 'Montreal', pl: 'Montreal' },
            ],
            hint: { en: 'Not Toronto — it sits on the Ottawa River.', pl: 'Nie Toronto — leży nad rzeką Ottawa.' },
        },
    ],
    // Rung 12
    [
        {
            id: 'ladder-023',
            question: { en: 'Which element has the atomic number 1?', pl: 'Który pierwiastek ma liczbę atomową 1?' },
            options: [
                { en: 'Hydrogen', pl: 'Wodór' },
                { en: 'Helium', pl: 'Hel' },
                { en: 'Oxygen', pl: 'Tlen' },
                { en: 'Carbon', pl: 'Węgiel' },
            ],
            hint: { en: 'The lightest and most abundant element.', pl: 'Najlżejszy i najpowszechniejszy pierwiastek.' },
        },
        {
            id: 'ladder-024',
            question: { en: 'Which element has the atomic number 6?', pl: 'Który pierwiastek ma liczbę atomową 6?' },
            options: [
                { en: 'Carbon', pl: 'Węgiel' },
                { en: 'Oxygen', pl: 'Tlen' },
                { en: 'Nitrogen', pl: 'Azot' },
                { en: 'Helium', pl: 'Hel' },
            ],
            hint: { en: 'The basis of all known life.', pl: 'Podstawa wszelkiego znanego życia.' },
        },
    ],
    // Rung 13
    [
        {
            id: 'ladder-025',
            question: { en: 'Who wrote the play "Romeo and Juliet"?', pl: 'Kto napisał dramat „Romeo i Julia”?' },
            options: [
                { en: 'William Shakespeare', pl: 'William Shakespeare' },
                { en: 'Charles Dickens', pl: 'Charles Dickens' },
                { en: 'Jane Austen', pl: 'Jane Austen' },
                { en: 'Leo Tolstoy', pl: 'Lew Tołstoj' },
            ],
            hint: { en: 'An English playwright from Stratford-upon-Avon.', pl: 'Angielski dramaturg ze Stratford-upon-Avon.' },
        },
        {
            id: 'ladder-026',
            question: { en: 'Who wrote the novel "War and Peace"?', pl: 'Kto napisał powieść „Wojna i pokój”?' },
            options: [
                { en: 'Leo Tolstoy', pl: 'Lew Tołstoj' },
                { en: 'Fyodor Dostoevsky', pl: 'Fiodor Dostojewski' },
                { en: 'Anton Chekhov', pl: 'Antoni Czechow' },
                { en: 'Ivan Turgenev', pl: 'Iwan Turgieniew' },
            ],
            hint: { en: 'A Russian author of epic length novels.', pl: 'Rosyjski autor obszernych powieści.' },
        },
    ],
    // Rung 14
    [
        {
            id: 'ladder-027',
            question: { en: 'What is the speed of light in a vacuum (approximately)?', pl: 'Jaka jest prędkość światła w próżni (w przybliżeniu)?' },
            options: [
                { en: '300,000 km/s', pl: '300 000 km/s' },
                { en: '150,000 km/s', pl: '150 000 km/s' },
                { en: '1,000 km/s', pl: '1 000 km/s' },
                { en: '3,000,000 km/s', pl: '3 000 000 km/s' },
            ],
            hint: { en: 'About 3 × 10⁸ metres per second.', pl: 'Około 3 × 10⁸ metrów na sekundę.' },
        },
        {
            id: 'ladder-028',
            question: { en: 'Which scientist proposed the theory of general relativity?', pl: 'Który naukowiec sformułował ogólną teorię względności?' },
            options: [
                { en: 'Albert Einstein', pl: 'Albert Einstein' },
                { en: 'Isaac Newton', pl: 'Isaac Newton' },
                { en: 'Niels Bohr', pl: 'Niels Bohr' },
                { en: 'Galileo Galilei', pl: 'Galileusz' },
            ],
            hint: { en: 'Famous for the equation E = mc².', pl: 'Słynny z równania E = mc².' },
        },
    ],
    // Rung 15
    [
        {
            id: 'ladder-029',
            question: { en: 'Which mathematician is credited with the discovery of calculus alongside Newton?', pl: 'Który matematyk obok Newtona uważany jest za twórcę rachunku różniczkowego?' },
            options: [
                { en: 'Gottfried Leibniz', pl: 'Gottfried Leibniz' },
                { en: 'Carl Gauss', pl: 'Carl Gauss' },
                { en: 'Leonhard Euler', pl: 'Leonhard Euler' },
                { en: 'Blaise Pascal', pl: 'Blaise Pascal' },
            ],
            hint: { en: 'A German philosopher who used the "∫" notation.', pl: 'Niemiecki filozof, który wprowadził zapis „∫”.' },
        },
        {
            id: 'ladder-030',
            question: { en: 'What is the only number that is neither prime nor composite?', pl: 'Jaka jest jedyna liczba, która nie jest ani pierwsza, ani złożona?' },
            options: [
                { en: '1', pl: '1' },
                { en: '0', pl: '0' },
                { en: '2', pl: '2' },
                { en: '-1', pl: '-1' },
            ],
            hint: { en: 'It has exactly one divisor.', pl: 'Ma dokładnie jeden dzielnik.' },
        },
    ],
];

export const ALL_PACK: ContentPack = {
    id: 'all',
    name: { en: 'Mixed Trivia', pl: 'Miks pytań' },
    rungs: RUNGS,
};

export const PACKS: ContentPack[] = [ALL_PACK];
