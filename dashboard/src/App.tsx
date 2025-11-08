import { Loader } from "@/components/retroui/Loader";

export const App = () => {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader className="scale-[3]" />
    </div>
  )
}