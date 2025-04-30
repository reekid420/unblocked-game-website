import React, { useEffect, useRef, useState } from 'react';

// Array of educational facts
const educationalFacts = [
  "Language fact: The most common letter in English is 'e'.",
  "Math fact: Zero is the only number that can't be represented in Roman numerals.",
  "Science fact: Lightning strikes the Earth about 8.6 million times per day.",
  "History fact: The shortest war in history was between Britain and Zanzibar in 1896, lasting just 38 minutes.",
  "Geography fact: Russia spans 11 time zones, more than any other country.",
  "Biology fact: The human body contains enough iron to make a 3-inch nail.",
  "Astronomy fact: A year on Venus is shorter than a day on Venus.",
  "Literature fact: Shakespeare invented over 1,700 words we use today.",
  "Technology fact: The first computer programmer was a woman, Ada Lovelace.",
  "Physics fact: A teaspoonful of neutron star would weigh about 6 billion tons.",
  "Chemistry fact: Glass is technically a liquid that flows very, very slowly.",
  "Psychology fact: The average person has about 12,000 to 60,000 thoughts per day.",
  "Art fact: Vincent van Gogh only sold one painting during his lifetime.",
  "Language fact: 'Pneumonoultramicroscopicsilicovolcanoconiosis' is the longest word in English dictionaries.",
  "Math fact: A 'jiffy' is an actual unit of time: 1/100th of a second.",
  "Science fact: Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old.",
  "History fact: Oxford University is older than the Aztec Empire.",
  "Geography fact: Australia is wider than the moon.",
  "Biology fact: Your body has enough DNA to stretch from the Sun to Pluto and back 17 times."
];

const FACT_INTERVAL_MS = 30000;

const RandomFact: React.FC = () => {
  const [fact, setFact] = useState(educationalFacts[0]);
  const timeoutRef = useRef<number | null>(null);

  const pickRandomFact = () => {
    const randomIndex = Math.floor(Math.random() * educationalFacts.length);
    setFact(educationalFacts[randomIndex]);
  };

  useEffect(() => {
    pickRandomFact(); // Pick one on mount
    timeoutRef.current = window.setInterval(pickRandomFact, FACT_INTERVAL_MS);
    return () => {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
    };
  }, []);

  // Animate opacity on fact change
  const factRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = factRef.current;
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => {
      el.style.transition = 'opacity 1s ease-in-out';
      el.style.opacity = '1';
    }, 100);
  }, [fact]);

  return (
    <p className="fact-message" ref={factRef} style={{ minHeight: 32 }}>
      {fact}
    </p>
  );
};

export default RandomFact;
