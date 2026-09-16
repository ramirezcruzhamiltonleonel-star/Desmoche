import CardBack from "./CardBack";
import Spinner from "./Spinner";

export default function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="screen-fade flex min-h-screen flex-col items-center justify-center gap-4 bg-felt-dark px-4">
      <div className="animate-pulse">
        <CardBack size="lg" />
      </div>
      <div className="flex items-center gap-2 text-sm text-stone-300">
        <Spinner size="sm" />
        <span>{message}</span>
      </div>
    </div>
  );
}
