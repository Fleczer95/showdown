// Bilingual question bank for "The Drop".
// Each question offers four real-world statistics; exactly one is the true
// figure. Distractors are plausible near-values. The pool is sampled down to
// TOTAL_ROUNDS questions per run by buildGame().
//
// Design note: these are deliberately *surprising* statistics, not common
// knowledge. The game only works if the player is genuinely uncertain — that
// uncertainty is what makes spreading the bank across options worthwhile. Every
// figure is a real, sourced value (rounded for legibility).

import type { DropQuestion } from './logic';

export type Language = 'en' | 'pl';

// 14 questions — buildGame() samples 9.
export const dropQuestions: DropQuestion[] = [
    {
        id: 'drop-001',
        prompt: {
            en: 'Roughly how many times does an average human heart beat in a day?',
            pl: 'Mniej więcej ile razy na dobę bije średnio ludzkie serce?',
        },
        options: [
            { en: '10,000', pl: '10 000' },
            { en: '100,000', pl: '100 000' },
            { en: '1,000,000', pl: '1 000 000' },
            { en: '10,000,000', pl: '10 000 000' },
        ],
        correctIndex: 1,
    },
    {
        id: 'drop-002',
        prompt: {
            en: 'Roughly how many languages are spoken in the world today?',
            pl: 'Iloma językami mówi się obecnie na świecie?',
        },
        options: [
            { en: '700', pl: '700' },
            { en: '3,000', pl: '3 000' },
            { en: '7,000', pl: '7 000' },
            { en: '15,000', pl: '15 000' },
        ],
        correctIndex: 2,
    },
    {
        id: 'drop-003',
        prompt: {
            en: "Roughly what share of the Earth's oxygen is produced by the ocean?",
            pl: 'Jaką część ziemskiego tlenu produkują oceany?',
        },
        options: [
            { en: '20%', pl: '20%' },
            { en: '50%', pl: '50%' },
            { en: '70%', pl: '70%' },
            { en: '90%', pl: '90%' },
        ],
        correctIndex: 1,
    },
    {
        id: 'drop-004',
        prompt: {
            en: 'Roughly how many people have ever been born in human history?',
            pl: 'Mniej więcej ilu ludzi w całej historii kiedykolwiek się urodziło?',
        },
        options: [
            { en: '12 billion', pl: '12 miliardów' },
            { en: '57 billion', pl: '57 miliardów' },
            { en: '117 billion', pl: '117 miliardów' },
            { en: '500 billion', pl: '500 miliardów' },
        ],
        correctIndex: 2,
    },
    {
        id: 'drop-005',
        prompt: {
            en: 'What is the total length of the Great Wall of China (all branches)?',
            pl: 'Jaka jest całkowita długość Wielkiego Muru Chińskiego (wszystkie odcinki)?',
        },
        options: [
            { en: '2,100 km', pl: '2 100 km' },
            { en: '8,850 km', pl: '8 850 km' },
            { en: '21,000 km', pl: '21 000 km' },
            { en: '50,000 km', pl: '50 000 km' },
        ],
        correctIndex: 2,
    },
    {
        id: 'drop-006',
        prompt: {
            en: 'Roughly how many hairs are on an average human head?',
            pl: 'Mniej więcej ile włosów ma przeciętna ludzka głowa?',
        },
        options: [
            { en: '10,000', pl: '10 000' },
            { en: '100,000', pl: '100 000' },
            { en: '500,000', pl: '500 000' },
            { en: '1,000,000', pl: '1 000 000' },
        ],
        correctIndex: 1,
    },
    {
        id: 'drop-007',
        prompt: {
            en: 'Roughly how many cells make up the human body?',
            pl: 'Mniej więcej z ilu komórek zbudowane jest ludzkie ciało?',
        },
        options: [
            { en: '37 billion', pl: '37 miliardów' },
            { en: '370 billion', pl: '370 miliardów' },
            { en: '37 trillion', pl: '37 bilionów' },
            { en: '37 quadrillion', pl: '37 biliardów' },
        ],
        correctIndex: 2,
    },
    {
        id: 'drop-008',
        prompt: {
            en: "Roughly what share of the Earth's water is fresh water?",
            pl: 'Jaką część wody na Ziemi stanowi woda słodka?',
        },
        options: [
            { en: '3%', pl: '3%' },
            { en: '10%', pl: '10%' },
            { en: '25%', pl: '25%' },
            { en: '50%', pl: '50%' },
        ],
        correctIndex: 0,
    },
    {
        id: 'drop-009',
        prompt: {
            en: 'Roughly how many islands make up Indonesia?',
            pl: 'Mniej więcej z ilu wysp składa się Indonezja?',
        },
        options: [
            { en: '1,700', pl: '1 700' },
            { en: '6,000', pl: '6 000' },
            { en: '17,000', pl: '17 000' },
            { en: '50,000', pl: '50 000' },
        ],
        correctIndex: 2,
    },
    {
        id: 'drop-010',
        prompt: {
            en: 'Roughly how many breaths does an average person take in a day?',
            pl: 'Mniej więcej ile oddechów bierze przeciętny człowiek w ciągu doby?',
        },
        options: [
            { en: '2,000', pl: '2 000' },
            { en: '20,000', pl: '20 000' },
            { en: '200,000', pl: '200 000' },
            { en: '2,000,000', pl: '2 000 000' },
        ],
        correctIndex: 1,
    },
    {
        id: 'drop-011',
        prompt: {
            en: 'Roughly how many bones is a baby born with?',
            pl: 'Z iloma mniej więcej kośćmi rodzi się niemowlę?',
        },
        options: [
            { en: '206', pl: '206' },
            { en: '250', pl: '250' },
            { en: '300', pl: '300' },
            { en: '350', pl: '350' },
        ],
        correctIndex: 2,
    },
    {
        id: 'drop-012',
        prompt: {
            en: 'Roughly how many neurons are in the human brain?',
            pl: 'Mniej więcej ile neuronów ma ludzki mózg?',
        },
        options: [
            { en: '86 million', pl: '86 milionów' },
            { en: '860 million', pl: '860 milionów' },
            { en: '86 billion', pl: '86 miliardów' },
            { en: '860 billion', pl: '860 miliardów' },
        ],
        correctIndex: 2,
    },
    {
        id: 'drop-013',
        prompt: {
            en: 'How long does sunlight take to travel from the Sun to the Earth?',
            pl: 'Ile czasu zajmuje światłu dotarcie ze Słońca do Ziemi?',
        },
        options: [
            { en: '8 seconds', pl: '8 sekund' },
            { en: '8 minutes', pl: '8 minut' },
            { en: '8 hours', pl: '8 godzin' },
            { en: '8 days', pl: '8 dni' },
        ],
        correctIndex: 1,
    },
    {
        id: 'drop-014',
        prompt: {
            en: 'How many time zones does France span, counting its overseas territories?',
            pl: 'Ile stref czasowych obejmuje Francja, wliczając terytoria zamorskie?',
        },
        options: [
            { en: '1', pl: '1' },
            { en: '5', pl: '5' },
            { en: '12', pl: '12' },
            { en: '24', pl: '24' },
        ],
        correctIndex: 2,
    },
];
