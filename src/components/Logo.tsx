import React from 'react';
import Image from 'next/image';

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Image 
        src="/logo-final.webp" 
        alt="Karen Acevedo Alcaldesa"
        width={360}
        height={95}
        className="object-contain w-auto h-auto max-h-[55px] md:max-h-[65px]"
        priority
      />
    </div>
  );
}
