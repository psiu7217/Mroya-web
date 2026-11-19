import React, {useEffect, useState} from 'react';
import {Mountain} from 'lucide-react';
import {tr} from '../i18n';
import {estimateImageGenerationProgress} from '../utils/imageGeneration';

export function ImageGenerationCard({phase}:{phase:'generating'|'finishing'}){
  const [estimated, setEstimated] = useState(() => estimateImageGenerationProgress(0));
  const generating = phase === 'generating';
  const progress = generating ? estimated : 100;
  const label = tr(generating ? 'imageGenerating' : 'imageFinishing', {ns:'chat'});

  useEffect(() => {
    if (!generating) return;
    const startedAt = performance.now();
    setEstimated(estimateImageGenerationProgress(0));
    const timer = window.setInterval(() => {
      setEstimated(estimateImageGenerationProgress(performance.now() - startedAt));
    }, 500);
    return () => window.clearInterval(timer);
  }, [generating]);

  return (
    <div className="mroya-image-generation relative isolate flex aspect-[4/3] w-full max-w-[34rem] items-end overflow-hidden rounded-xl" data-phase={phase}>
      <div className="mroya-image-generation-wave" aria-hidden="true" />
      <div className="absolute inset-0 grid place-items-center text-[var(--mroya-text-muted)] opacity-40" aria-hidden="true">
        <Mountain className="size-9 sm:size-12"/>
      </div>
      <div className="mroya-image-generation-footer relative flex w-full items-center justify-between gap-2 px-3 pb-3 pt-6 text-xs font-medium sm:px-4 sm:pb-4 sm:text-sm">
        <p role="status" className="text-[var(--mroya-text-muted)]">{label}</p>
        <span className="shrink-0 rounded-lg bg-[var(--mroya-surface)] px-2.5 py-1 tabular-nums text-[var(--mroya-primary)]" role="progressbar"
          aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
          aria-valuetext={generating ? tr('imageProgressEstimate', {ns:'chat', progress}) : '100%'}>
          <span aria-hidden="true">{generating ? '≈' : ''}{progress}%</span>
        </span>
      </div>
    </div>
  );
}
