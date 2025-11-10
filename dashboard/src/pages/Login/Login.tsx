import { useState, useContext } from "react";
import { Card } from "@/components/retroui/Card";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { Lock, LogIn } from "lucide-react";
import banner from "@/common/assets/banner.png";
import { AuthContext } from "@/common/contexts/AuthProvider";

export const Login = () => {
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const { login } = useContext(AuthContext);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            await login(password);
        } catch (err) {
            setError("Invalid password");
            console.error("Login failed:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-md flex flex-col items-center justify-center">
                <div className="text-center mb-8 w-full">
                    <img
                        src={banner}
                        alt="Arcader"
                        className="mx-auto max-w-full h-auto"
                    />
                </div>

                <Card className="border-4 border-foreground bg-card overflow-hidden w-full">
                    <Card.Content className="space-y-4 p-6">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-head font-semibold text-foreground">
                                    PASSWORD
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <Input
                                        type="password"
                                        placeholder="Enter password"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        className="font-sans pl-11 bg-background"
                                        required
                                    />
                                </div>
                                {error && (
                                    <p className="text-sm text-red-500 font-semibold">
                                        {error}
                                    </p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                variant="default"
                                size="lg"
                                className="w-full mt-6 font-bold tracking-wider gap-2"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    "LOADING..."
                                ) : (
                                    <>
                                        <LogIn className="w-5 h-5" />
                                        LOGIN
                                    </>
                                )}
                            </Button>
                        </form>
                    </Card.Content>
                </Card>
            </div>
        </div>
    );
};
