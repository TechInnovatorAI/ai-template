export function LoadingBubble() {
  const dotClassName = `rounded-full dark:bg-dark-600 bg-gray-100 h-2.5 w-2.5`;

  return (
    <div
      className={
        'mt-4 py-4 duration-1000 ease-out animate-in slide-in-from-bottom-12'
      }
    >
      <div className={'duration-750 flex animate-bounce space-x-1'}>
        <div className={dotClassName} />
        <div className={dotClassName} />
        <div className={dotClassName} />
      </div>
    </div>
  );
}
