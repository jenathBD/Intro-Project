'use client';
import { useState } from 'react';
 
function Header({ title }) {
  return <h1>{title ? title : 'Default title'}</h1>;
}
 
export default function HomePage() {
  return <Header title="Develop. Preview. Ship." />;
}