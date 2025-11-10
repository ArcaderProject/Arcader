import { Button } from "@/components/retroui/Button.tsx";
import { useContext, useState } from "react";
import { AuthContext } from "@/common/contexts/AuthProvider.tsx";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Settings, Gamepad2, LogOut, Menu, X, ListChecks } from "lucide-react";
import banner from "@/common/assets/banner.png";
import { PacmanAnimation } from "./PacmanAnimation.tsx";

export const Navigation = () => {
    const { logout } = useContext(AuthContext);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isPacmanActive, setIsPacmanActive] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const navItems = [
        { to: "/games", icon: Gamepad2, label: "Games" },
        { to: "/lists", icon: ListChecks, label: "Lists" },
        { to: "/settings", icon: Settings, label: "Settings" },
    ];

    const handleLogoClick = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        setIsPacmanActive(true);
    };

    const handleAnimationComplete = () => {
        setIsPacmanActive(false);
        setIsAnimating(false);
    };

    return (
        <nav className="w-full bg-[#0a0a0a] border-b border-primary/50">
            <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4 gap-2 sm:gap-4">
                <button
                    onClick={handleLogoClick}
                    className="py-2 flex-shrink-0 relative cursor-pointer focus:outline-none group"
                    aria-label="Arcader Logo"
                    disabled={isAnimating}
                >
                    <img
                        src={banner}
                        alt="Arcader"
                        className={cn(
                            "h-8 md:h-10 w-auto transition-all duration-300",
                            isPacmanActive
                                ? "opacity-0 scale-0"
                                : "opacity-100 scale-100 group-hover:scale-105",
                        )}
                    />

                    {isPacmanActive && (
                        <PacmanAnimation
                            isActive={isPacmanActive}
                            onComplete={handleAnimationComplete}
                        />
                    )}
                </button>

                <div className="hidden lg:flex items-center gap-3 xl:gap-4 flex-1 justify-center px-4">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-2 px-3 xl:px-4 py-2 font-head text-xs xl:text-sm font-normal transition-all duration-200 bg-secondary border-2 border-border whitespace-nowrap",
                                    isActive
                                        ? "text-primary-foreground bg-primary shadow-md translate-y-0"
                                        : "text-foreground hover:translate-y-1 shadow-sm hover:shadow-none active:translate-y-1",
                                )
                            }
                        >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            <span className="uppercase tracking-wider hidden xl:inline">
                                {item.label}
                            </span>
                            <span className="uppercase tracking-wider xl:hidden">
                                {item.label.charAt(0)}
                            </span>
                        </NavLink>
                    ))}
                </div>

                <Button
                    variant="secondary"
                    size="sm"
                    className="hidden lg:flex gap-2 uppercase font-bold flex-shrink-0 ml-auto text-xs xl:text-sm"
                    onClick={logout}
                >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden xl:inline">LOGOUT</span>
                </Button>

                <button
                    className="lg:hidden p-2 text-foreground/70 hover:text-primary transition-all ml-auto"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label="Toggle menu"
                >
                    {isMobileMenuOpen ? (
                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                    ) : (
                        <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                </button>
            </div>

            {isMobileMenuOpen && (
                <div className="lg:hidden border-t-2 border-border bg-[#0a0a0a] px-4 sm:px-6 py-4 space-y-2 animate-in slide-in-from-top duration-200">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 px-4 py-3 font-head text-sm sm:text-base font-normal transition-all duration-200 w-full uppercase tracking-wider bg-secondary border-2 border-border",
                                    isActive
                                        ? "text-primary-foreground bg-primary shadow-md"
                                        : "text-foreground active:translate-y-1 shadow-sm active:shadow-none",
                                )
                            }
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                    <div className="pt-2 mt-2 border-t-2 border-border">
                        <Button
                            variant="secondary"
                            size="md"
                            className="w-full gap-2 uppercase font-bold"
                            onClick={() => {
                                setIsMobileMenuOpen(false);
                                logout();
                            }}
                        >
                            <LogOut className="w-5 h-5" />
                            LOGOUT
                        </Button>
                    </div>
                </div>
            )}
        </nav>
    );
};
