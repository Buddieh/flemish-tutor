// Scenes shown in the menu. `preview` phrases are taught before the scene starts
// and added to the word deck when the session ends.
export const SCENES = [
  {
    id: 'bakker',
    title: 'Bij de bakker',
    en: 'At the bakery',
    role: 'a friendly baker in a small bakery in Gent, morning rush',
    preview: [
      { nl: 'Wat mag het zijn?', en: 'What can I get you?' },
      { nl: 'Is ’t dat? Nog iets anders?', en: 'Is that everything? Anything else?' },
      { nl: 'Ne grijze, gesneden alstublieft', en: 'A brown loaf, sliced please' },
    ],
  },
  {
    id: 'frituur',
    title: 'In de frituur',
    en: 'At the chip shop',
    role: 'the owner of a busy frituur on a Friday evening',
    preview: [
      { nl: 'E klein pakje frieten met mayonaise', en: 'A small portion of fries with mayo' },
      { nl: 'Om mee te nemen of om hier te eten?', en: 'Take away or eat in?' },
      { nl: 'Ne frikandel speciaal', en: 'A frikandel with mayo, curry ketchup and onions' },
    ],
  },
  {
    id: 'buur',
    title: 'De buur over de haag',
    en: 'The neighbour over the hedge',
    role: 'a chatty retired neighbour in their sixties, talking over the garden hedge',
    preview: [
      { nl: 'Schoon weer vandaag, hé!', en: 'Lovely weather today, eh!' },
      { nl: 'Ge zijt goed bezig in uwen hof', en: 'You’re working hard in your garden' },
      { nl: 'Allee, tot seffens!', en: 'Right then, see you later!' },
    ],
  },
  {
    id: 'collega',
    title: 'Aan de koffiemachine',
    en: 'At the coffee machine',
    role: 'a colleague in their thirties, chatting at the office coffee machine on a Monday',
    preview: [
      { nl: 'Hoe was uw weekend?', en: 'How was your weekend?' },
      { nl: '’t Was plezant, maar veel te kort', en: 'It was fun, but way too short' },
      { nl: 'Ik heb gene goesting om te werken', en: 'I don’t feel like working' },
    ],
  },
  {
    id: 'apotheek',
    title: 'In de apotheek',
    en: 'At the pharmacy',
    role: 'a pharmacist helping a customer with a cold',
    preview: [
      { nl: 'Hebt ge e voorschrift?', en: 'Do you have a prescription?' },
      { nl: 'Ik ben verkouden en ik heb keelpijn', en: 'I have a cold and a sore throat' },
      { nl: 'Drie keer per dag, na het eten', en: 'Three times a day, after eating' },
    ],
  },
  {
    id: 'huisarts',
    title: 'Bij de huisarts',
    en: 'At the GP',
    role: 'a calm family doctor (huisarts) during a consultation',
    preview: [
      { nl: 'Wat scheelt er?', en: 'What’s the matter?' },
      { nl: 'Sinds wanneer hebt ge da?', en: 'Since when have you had that?' },
      { nl: 'Ik schrijf u e briefke voor het werk', en: 'I’ll write you a sick note for work' },
    ],
  },
  {
    id: 'loket',
    title: 'Aan het loket van de stad',
    en: 'At the city hall desk',
    role: 'a clerk at the Gent city services desk (Stad Gent), slightly busy but helpful',
    preview: [
      { nl: 'Hebt ge e afspraak gemaakt?', en: 'Did you make an appointment?' },
      { nl: 'Uw identiteitskaart, alstublieft', en: 'Your ID card, please' },
      { nl: 'Da moet ge online aanvragen', en: 'You have to request that online' },
    ],
  },
  {
    id: 'cafe',
    title: 'Op café met vrienden',
    en: 'At the pub with friends',
    role: 'a Gentse friend at a café on the Vrijdagmarkt, relaxed and joking',
    preview: [
      { nl: 'Wa drinkte gij?', en: 'What are you drinking?' },
      { nl: 'Ik trakteer, de volgende is voor u', en: 'This round’s on me, the next is yours' },
      { nl: 'Amai, da’s straf!', en: 'Wow, that’s impressive / crazy!' },
    ],
  },
  {
    id: 'kassa',
    title: 'Aan de kassa',
    en: 'At the supermarket checkout',
    role: 'a cashier at a Colruyt or Delhaize supermarket',
    preview: [
      { nl: 'Hebt ge ne zak nodig?', en: 'Do you need a bag?' },
      { nl: 'Betaalt ge met Bancontact?', en: 'Are you paying by card?' },
      { nl: 'Wilt ge uw kassaticket?', en: 'Do you want your receipt?' },
    ],
  },
  {
    id: 'loodgieter',
    title: 'De loodgieter bellen',
    en: 'Calling a plumber',
    role: 'a busy plumber answering the phone about a leaking pipe',
    preview: [
      { nl: 'Er lekt water onder de lavabo', en: 'Water is leaking under the sink' },
      { nl: 'Ik kan pas volgende week passeren', en: 'I can only come by next week' },
      { nl: 'Da’s ambetant, hé', en: 'That’s annoying, eh' },
    ],
  },
  {
    id: 'sport',
    title: 'Op de sportclub',
    en: 'At the sports club',
    role: 'a member of a local sports club welcoming a newcomer before training',
    preview: [
      { nl: 'Zijt ge nieuw hier?', en: 'Are you new here?' },
      { nl: 'We trainen elke dinsdag om acht uur', en: 'We train every Tuesday at eight' },
      { nl: 'Na de training drinken we nog e pintje', en: 'After training we have a beer' },
    ],
  },
  {
    id: 'feestje',
    title: 'Op een verjaardagsfeestje',
    en: 'At a birthday party',
    role: 'a guest at a friend’s birthday party who doesn’t know you yet',
    preview: [
      { nl: 'Van waar kent gij de jarige?', en: 'How do you know the birthday person?' },
      { nl: 'Ge spreekt al goed Vlaams!', en: 'You already speak good Flemish!' },
      { nl: 'Gelukkige verjaardag! Proficiat!', en: 'Happy birthday! Congratulations!' },
    ],
  },
  {
    id: 'vrij',
    title: 'Vrij gesprek',
    en: 'Free conversation',
    role: 'a friendly Gentenaar who chats about whatever comes up: weather, food, weekend plans, the city',
    preview: [
      { nl: 'Awel, hoe is ’t?', en: 'Well, how’s it going?' },
      { nl: 'Wa zijn uw plannen voor dit weekend?', en: 'What are your plans this weekend?' },
      { nl: 'Da’s waar, zenne', en: 'That’s true, you know' },
    ],
  },
];

export const sceneById = (id) => SCENES.find((s) => s.id === id);
