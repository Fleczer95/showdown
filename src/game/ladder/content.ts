// Bilingual question bank for "The Ladder".
// Questions are grouped into 15 rungs of increasing difficulty.
// The UI (LadderPlayScreen) samples from these rungs using 5 difficulty pools.

export interface LocalizedString {
    en: string;
    pl: string;
}

export interface QuestionOption {
    en: string;
    pl: string;
}

export interface QuestionContent {
    id: string;
    question: LocalizedString;
    options: QuestionOption[];
    correctIndex: number;
    hint: LocalizedString;
}

export const RUNGS: QuestionContent[][] = [
    // Rung 1 - Very Easy (Pool 1)
    [
        { id: 'ladder-001', question: { en: 'What color is the sky on a clear day?', pl: 'Jakiego koloru jest niebo w słoneczny dzień?' }, options: [{ en: 'Green', pl: 'Zielony' }, { en: 'Blue', pl: 'Niebieski' }, { en: 'Red', pl: 'Czerwony' }, { en: 'Yellow', pl: 'Żółty' }], correctIndex: 1, hint: { en: 'Like the ocean.', pl: 'Jak ocean.' } },
        { id: 'ladder-002', question: { en: 'How many legs does a dog have?', pl: 'Ile nóg ma pies?' }, options: [{ en: '2', pl: '2' }, { en: '4', pl: '4' }, { en: '6', pl: '6' }, { en: '8', pl: '8' }], correctIndex: 1, hint: { en: 'Two pairs.', pl: 'Dwie pary.' } },
        { id: 'ladder-003', question: { en: 'Which animal is known as the king of the jungle?', pl: 'Które zwierzę jest znane jako król dżungli?' }, options: [{ en: 'Tiger', pl: 'Tygrys' }, { en: 'Elephant', pl: 'Słoń' }, { en: 'Lion', pl: 'Lew' }, { en: 'Bear', pl: 'Niedźwiedź' }], correctIndex: 2, hint: { en: 'It has a mane.', pl: 'Ma grzywę.' } },
        { id: 'ladder-004', question: { en: 'What is 2 + 2?', pl: 'Ile to jest 2 + 2?' }, options: [{ en: '3', pl: '3' }, { en: '4', pl: '4' }, { en: '5', pl: '5' }, { en: '22', pl: '22' }], correctIndex: 1, hint: { en: 'Double two.', pl: 'Podwójne dwa.' } },
        { id: 'ladder-005', question: { en: 'What is the capital of Poland?', pl: 'Jaka jest stolica Polski?' }, options: [{ en: 'Krakow', pl: 'Kraków' }, { en: 'Warsaw', pl: 'Warszawa' }, { en: 'Gdansk', pl: 'Gdańsk' }, { en: 'Wroclaw', pl: 'Wrocław' }], correctIndex: 1, hint: { en: 'The Mermaid city.', pl: 'Miasto Syrenki.' } },
        { id: 'ladder-006', question: { en: 'How many fingers does a human have on one hand?', pl: 'Ile palców u jednej ręki ma człowiek?' }, options: [{ en: '4', pl: '4' }, { en: '5', pl: '5' }, { en: '6', pl: '6' }, { en: '10', pl: '10' }], correctIndex: 1, hint: { en: 'High five.', pl: 'Piątka.' } },
        { id: 'ladder-007', question: { en: 'Which fruit is usually red or green?', pl: 'Który owoc jest zazwyczaj czerwony lub zielony?' }, options: [{ en: 'Banana', pl: 'Banan' }, { en: 'Apple', pl: 'Jabłko' }, { en: 'Orange', pl: 'Pomarańcza' }, { en: 'Grape', pl: 'Winogrono' }], correctIndex: 1, hint: { en: 'Newton\'s fruit.', pl: 'Owoc Newtona.' } },
        { id: 'ladder-008', question: { en: 'How many days are in a week?', pl: 'Ile dni ma tydzień?' }, options: [{ en: '5', pl: '5' }, { en: '6', pl: '6' }, { en: '7', pl: '7' }, { en: '8', pl: '8' }], correctIndex: 2, hint: { en: 'Includes Sunday.', pl: 'Obejmuje niedzielę.' } },
        { id: 'ladder-009', question: { en: 'What do bees make?', pl: 'Co robią pszczoły?' }, options: [{ en: 'Milk', pl: 'Mleko' }, { en: 'Honey', pl: 'Miód' }, { en: 'Sugar', pl: 'Cukier' }, { en: 'Juice', pl: 'Sok' }], correctIndex: 1, hint: { en: 'Sweet and sticky.', pl: 'Słodkie i lepkie.' } },
        { id: 'ladder-010', question: { en: 'Which planet is closest to the Sun?', pl: 'Która planeta jest najbliżej Słońca?' }, options: [{ en: 'Venus', pl: 'Wenus' }, { en: 'Mars', pl: 'Mars' }, { en: 'Mercury', pl: 'Merkury' }, { en: 'Earth', pl: 'Ziemia' }], correctIndex: 2, hint: { en: 'Small and hot.', pl: 'Mała i gorąca.' } },
        { id: 'ladder-011', question: { en: 'What is the opposite of hot?', pl: 'Co jest przeciwieństwem gorąca?' }, options: [{ en: 'Warm', pl: 'Ciepły' }, { en: 'Cold', pl: 'Zimny' }, { en: 'Ice', pl: 'Lód' }, { en: 'Dry', pl: 'Suchy' }], correctIndex: 1, hint: { en: 'Like winter.', pl: 'Jak zima.' } },
        { id: 'ladder-012', question: { en: 'What color are bananas?', pl: 'Jakiego koloru są banany?' }, options: [{ en: 'Purple', pl: 'Fioletowy' }, { en: 'Yellow', pl: 'Żółty' }, { en: 'Green', pl: 'Zielony' }, { en: 'Red', pl: 'Czerwony' }], correctIndex: 1, hint: { en: 'Bright color.', pl: 'Jasny kolor.' } },
        { id: 'ladder-013', question: { en: 'How many wheels does a tricycle have?', pl: 'Ile kół ma trójkołowiec?' }, options: [{ en: '2', pl: '2' }, { en: '3', pl: '3' }, { en: '4', pl: '4' }, { en: '5', pl: '5' }], correctIndex: 1, hint: { en: 'Check the name.', pl: 'Sprawdź nazwę.' } },
        { id: 'ladder-014', question: { en: 'Which is a primary color?', pl: 'Który to kolor podstawowy?' }, options: [{ en: 'Pink', pl: 'Różowy' }, { en: 'Red', pl: 'Czerwony' }, { en: 'Orange', pl: 'Pomarańczowy' }, { en: 'Brown', pl: 'Brązowy' }], correctIndex: 1, hint: { en: 'RGB.', pl: 'RGB.' } },
        { id: 'ladder-015', question: { en: 'Which animal says woof?', pl: 'Które zwierzę robi hau?' }, options: [{ en: 'Cat', pl: 'Kot' }, { en: 'Cow', pl: 'Krowa' }, { en: 'Dog', pl: 'Pies' }, { en: 'Bird', pl: 'Ptak' }], correctIndex: 2, hint: { en: 'Man\'s best friend.', pl: 'Najlepszy przyjaciel człowieka.' } },
        { id: 'ladder-016', question: { en: 'How many months are in a year?', pl: 'Ile miesięcy ma rok?' }, options: [{ en: '10', pl: '10' }, { en: '11', pl: '11' }, { en: '12', pl: '12' }, { en: '13', pl: '13' }], correctIndex: 2, hint: { en: 'Last is December.', pl: 'Ostatni to grudzień.' } },
        { id: 'ladder-017', question: { en: 'What do cows drink?', pl: 'Co piją krowy?' }, options: [{ en: 'Milk', pl: 'Mleko' }, { en: 'Water', pl: 'Wodę' }, { en: 'Juice', pl: 'Sok' }, { en: 'Soda', pl: 'Napój' }], correctIndex: 1, hint: { en: 'Most animals drink this.', pl: 'Pije to większość zwierząt.' } },
        { id: 'ladder-018', question: { en: 'What is the frozen form of water?', pl: 'Czym jest zamarznięta woda?' }, options: [{ en: 'Steam', pl: 'Para' }, { en: 'Mist', pl: 'Mgła' }, { en: 'Ice', pl: 'Lód' }, { en: 'Snow', pl: 'Śnieg' }], correctIndex: 2, hint: { en: 'Cold solid.', pl: 'Zimne ciało stałe.' } },
        { id: 'ladder-019', question: { en: 'Which sense do you use to hear?', pl: 'Którego zmysłu używasz do słyszenia?' }, options: [{ en: 'Sight', pl: 'Wzrok' }, { en: 'Smell', pl: 'Węch' }, { en: 'Hearing', pl: 'Słuch' }, { en: 'Taste', pl: 'Smak' }], correctIndex: 2, hint: { en: 'Using ears.', pl: 'Używasz uszu.' } },
        { id: 'ladder-020', question: { en: 'What shape is a soccer ball?', pl: 'Jaki kształt ma piłka nożna?' }, options: [{ en: 'Square', pl: 'Kwadrat' }, { en: 'Triangle', pl: 'Trójkąt' }, { en: 'Circle', pl: 'Koło' }, { en: 'Sphere', pl: 'Kula' }], correctIndex: 3, hint: { en: '3D round shape.', pl: 'Kształt trójwymiarowy.' } },
        { id: 'ladder-021', question: { en: 'Where does the Sun rise?', pl: 'Gdzie wschodzi Słońce?' }, options: [{ en: 'North', pl: 'Północ' }, { en: 'South', pl: 'Południe' }, { en: 'East', pl: 'Wschód' }, { en: 'West', pl: 'Zachód' }], correctIndex: 2, hint: { en: 'Opposite of West.', pl: 'Naprzeciw zachodu.' } },
        { id: 'ladder-022', question: { en: 'Which of these is a vegetable?', pl: 'Które z nich to warzywo?' }, options: [{ en: 'Carrot', pl: 'Marchewka' }, { en: 'Apple', pl: 'Jabłko' }, { en: 'Orange', pl: 'Pomarańcza' }, { en: 'Grape', pl: 'Winogrono' }], correctIndex: 0, hint: { en: 'Orange and crunchy.', pl: 'Pomarańczowa i chrupiąca.' } },
        { id: 'ladder-023', question: { en: 'How many sides does a triangle have?', pl: 'Ile boków ma trójkąt?' }, options: [{ en: '2', pl: '2' }, { en: '3', pl: '3' }, { en: '4', pl: '4' }, { en: '5', pl: '5' }], correctIndex: 1, hint: { en: 'Tri means...', pl: 'Tri oznacza...' } },
        { id: 'ladder-024', question: { en: 'What is the color of an emerald?', pl: 'Jakiego koloru jest szmaragd?' }, options: [{ en: 'Red', pl: 'Czerwony' }, { en: 'Blue', pl: 'Niebieski' }, { en: 'Green', pl: 'Zielony' }, { en: 'Yellow', pl: 'Żółty' }], correctIndex: 2, hint: { en: 'Color of grass.', pl: 'Kolor trawy.' } },
        { id: 'ladder-025', question: { en: 'What do you call a baby cat?', pl: 'Jak nazywa się mały kot?' }, options: [{ en: 'Puppy', pl: 'Szczeniak' }, { en: 'Kitten', pl: 'Kotek' }, { en: 'Calf', pl: 'Cielę' }, { en: 'Cub', pl: 'Lwiątko' }], correctIndex: 1, hint: { en: 'Starts with K.', pl: 'Zaczyna się na K.' } },
    ],
    // Rung 2 (Pool 1)
    [
        { id: 'ladder-026', question: { en: 'How many planets are in the solar system?', pl: 'Ile planet jest w układzie słonecznym?' }, options: [{ en: '7', pl: '7' }, { en: '8', pl: '8' }, { en: '9', pl: '9' }, { en: '10', pl: '10' }], correctIndex: 1, hint: { en: 'Pluto is not one.', pl: 'Pluton nie jest planetą.' } },
    ],
    // Rung 3 (Pool 1)
    [
        { id: 'ladder-050', question: { en: 'What is the largest ocean?', pl: 'Który ocean jest największy?' }, options: [{ en: 'Atlantic', pl: 'Atlantycki' }, { en: 'Pacific', pl: 'Spokojny' }, { en: 'Indian', pl: 'Indyjski' }, { en: 'Arctic', pl: 'Arktyczny' }], correctIndex: 1, hint: { en: 'Very peaceful name.', pl: 'Ma spokojną nazwę.' } },
    ],
    // Rung 4 (Pool 2)
    [
        { id: 'ladder-100', question: { en: 'Which gas do humans need to breathe?', pl: 'Którego gazu ludzie potrzebują do oddychania?' }, options: [{ en: 'Nitrogen', pl: 'Azot' }, { en: 'Oxygen', pl: 'Tlen' }, { en: 'Hydrogen', pl: 'Wodór' }, { en: 'Carbon', pl: 'Węgiel' }], correctIndex: 1, hint: { en: 'O2.', pl: 'O2.' } },
    ],
    // Rung 5 (Pool 2)
    [
        { id: 'ladder-150', question: { en: 'What is the capital of Italy?', pl: 'Jaka jest stolica Włoch?' }, options: [{ en: 'Venice', pl: 'Wenecja' }, { en: 'Milan', pl: 'Mediolan' }, { en: 'Rome', pl: 'Rzym' }, { en: 'Naples', pl: 'Neapol' }], correctIndex: 2, hint: { en: 'All roads lead there.', pl: 'Wszystkie drogi tam prowadzą.' } },
    ],
    // Rung 6 (Pool 2)
    [
        { id: 'ladder-200', question: { en: 'How many strings on a standard guitar?', pl: 'Ile strun ma standardowa gitara?' }, options: [{ en: '4', pl: '4' }, { en: '5', pl: '5' }, { en: '6', pl: '6' }, { en: '12', pl: '12' }], correctIndex: 2, hint: { en: 'EADGBE.', pl: 'EADGBE.' } },
    ],
    // Rung 7 (Pool 3)
    [
        { id: 'ladder-250', question: { en: 'Which element has the symbol Au?', pl: 'Który pierwiastek ma symbol Au?' }, options: [{ en: 'Silver', pl: 'Srebro' }, { en: 'Gold', pl: 'Złoto' }, { en: 'Iron', pl: 'Żelazo' }, { en: 'Lead', pl: 'Ołów' }], correctIndex: 1, hint: { en: 'Aurum.', pl: 'Aurum.' } },
    ],
    // Rung 8 (Pool 3)
    [
        { id: 'ladder-300', question: { en: 'What is the largest planet in our solar system?', pl: 'Jaka jest największa planeta w naszym układzie?' }, options: [{ en: 'Saturn', pl: 'Saturn' }, { en: 'Jupiter', pl: 'Jowisz' }, { en: 'Neptune', pl: 'Neptun' }, { en: 'Earth', pl: 'Ziemia' }], correctIndex: 1, hint: { en: 'The gas giant.', pl: 'Gazowy gigant.' } },
    ],
    // Rung 9 (Pool 3)
    [
        { id: 'ladder-350', question: { en: 'Who painted the Mona Lisa?', pl: 'Kto namalował Monę Lisę?' }, options: [{ en: 'Van Gogh', pl: 'Van Gogh' }, { en: 'Picasso', pl: 'Picasso' }, { en: 'Da Vinci', pl: 'Da Vinci' }, { en: 'Dali', pl: 'Dali' }], correctIndex: 2, hint: { en: 'Leonardo.', pl: 'Leonardo.' } },
    ],
    // Rung 10 (Pool 4)
    [
        { id: 'ladder-400', question: { en: 'What is the capital of Australia?', pl: 'Jaka jest stolica Australii?' }, options: [{ en: 'Sydney', pl: 'Sydney' }, { en: 'Melbourne', pl: 'Melbourne' }, { en: 'Canberra', pl: 'Canberra' }, { en: 'Perth', pl: 'Perth' }], correctIndex: 2, hint: { en: 'Planned city.', pl: 'Miasto planowane.' } },
    ],
    // Rung 11 (Pool 4)
    [
        { id: 'ladder-450', question: { en: 'How many elements are in the periodic table?', pl: 'Ile pierwiastków jest w układzie okresowym?' }, options: [{ en: '92', pl: '92' }, { en: '108', pl: '108' }, { en: '118', pl: '118' }, { en: '124', pl: '124' }], correctIndex: 2, hint: { en: 'Ends with Oganesson.', pl: 'Kończy się na Oganeson.' } },
    ],
    // Rung 12 (Pool 4)
    [
        { id: 'ladder-500', question: { en: 'In which year did the Titanic sink?', pl: 'W którym roku zatonął Titanic?' }, options: [{ en: '1905', pl: '1905' }, { en: '1912', pl: '1912' }, { en: '1918', pl: '1918' }, { en: '1923', pl: '1923' }], correctIndex: 1, hint: { en: 'Before WW1.', pl: 'Przed I wojną światową.' } },
    ],
    // Rung 13 (Pool 5)
    [
        { id: 'ladder-550', question: { en: 'What is the rarest blood type?', pl: 'Jaka jest najrzadsza grupa krwi?' }, options: [{ en: 'O negative', pl: '0 Rh-' }, { en: 'AB positive', pl: 'AB Rh+' }, { en: 'AB negative', pl: 'AB Rh-' }, { en: 'B negative', pl: 'B Rh-' }], correctIndex: 2, hint: { en: 'Universal recipient is AB+.', pl: 'Uniwersalny biorca to AB+.' } },
    ],
    // Rung 14 (Pool 5)
    [
        { id: 'ladder-600', question: { en: 'Which planet has the shortest day?', pl: 'Która planeta ma najkrótszy dzień?' }, options: [{ en: 'Mars', pl: 'Mars' }, { en: 'Jupiter', pl: 'Jowisz' }, { en: 'Venus', pl: 'Wenus' }, { en: 'Mercury', pl: 'Merkury' }], correctIndex: 1, hint: { en: 'About 10 hours.', pl: 'Około 10 godzin.' } },
    ],
    // Rung 15 - Hard (Pool 5)
    [
        { id: 'ladder-650', question: { en: 'How many hearts does an octopus have?', pl: 'Ile serc ma ośmiornica?' }, options: [{ en: '1', pl: '1' }, { en: '2', pl: '2' }, { en: '3', pl: '3' }, { en: '8', pl: '8' }], correctIndex: 2, hint: { en: 'Triple pump.', pl: 'Potrójna pompa.' } },
    ],
];
