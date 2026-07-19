'use client'

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ArrowLeft, Palette, UserRound, KeyRound, Lock, Globe, TriangleAlert, Loader2, Eye, EyeOff } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { ProfileEditForm } from "@/components/profile/ProfileEditForm"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api/axios"
import { useMe } from "@/hook/useMe"
import { useUpdateProfile } from "@/hook/useUpdateProfile"
import { useAuth } from "@/context/AuthContext"

const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(6, "New password must be at least 6 characters"),
        confirmPassword: z.string(),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    })

type ChangePasswordData = z.infer<typeof changePasswordSchema>

function apiError(err: unknown, fallback: string) {
    return (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback
}

function ChangePasswordSection() {
    const [showPassword, setShowPassword] = useState(false)
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ChangePasswordData>({ resolver: zodResolver(changePasswordSchema) })

    const onSubmit = async (data: ChangePasswordData) => {
        try {
            await api.post("/user/change-password", {
                currentPassword: data.currentPassword,
                newPassword: data.newPassword,
            })
            toast.success("Password updated successfully")
            reset()
        } catch (err) {
            toast.error(apiError(err, "Failed to update password"))
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <div className="relative">
                    <input
                        id="currentPassword"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        {...register("currentPassword")}
                        className="h-10 w-full rounded-md border border-input bg-transparent px-3 pr-10 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                </div>
                {errors.currentPassword && (
                    <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...register("newPassword")}
                    className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50"
                />
                {errors.newPassword && (
                    <p className="text-sm text-destructive">{errors.newPassword.message}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...register("confirmPassword")}
                    className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50"
                />
                {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                    <>
                        <Loader2 className="size-4 animate-spin" />
                        Updating...
                    </>
                ) : (
                    "Update password"
                )}
            </Button>
        </form>
    )
}

function PrivacySection() {
    const { data: user } = useMe()
    const updateProfile = useUpdateProfile()
    const isPrivate = !!user?.isPrivate

    const toggle = () => {
        updateProfile.mutate(
            { isPrivate: !isPrivate },
            {
                onSuccess: () =>
                    toast.success(!isPrivate ? "Your account is now private" : "Your account is now public"),
                onError: (err) => toast.error(apiError(err, "Failed to update privacy")),
            }
        )
    }

    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2">
                {isPrivate ? (
                    <Lock className="mt-0.5 size-4 text-muted-foreground" />
                ) : (
                    <Globe className="mt-0.5 size-4 text-muted-foreground" />
                )}
                <div>
                    <p className="text-sm font-medium">Private account</p>
                    <p className="text-xs text-muted-foreground">
                        {isPrivate
                            ? "Only your followers can see your profile and posts."
                            : "Anyone can see your profile and posts."}
                    </p>
                </div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={isPrivate}
                aria-label="Toggle private account"
                disabled={updateProfile.isPending}
                onClick={toggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                    isPrivate ? "bg-primary" : "bg-muted-foreground/30"
                }`}
            >
                <span
                    className={`inline-block size-5 transform rounded-full bg-background shadow transition-transform ${
                        isPrivate ? "translate-x-5" : "translate-x-0.5"
                    }`}
                />
            </button>
        </div>
    )
}

function DangerZoneSection() {
    const { logout } = useAuth()
    const [open, setOpen] = useState(false)
    const [password, setPassword] = useState("")
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        if (!password) {
            toast.error("Please enter your password to confirm")
            return
        }
        setDeleting(true)
        try {
            await api.delete("/user", { data: { password } })
            toast.success("Your account has been deleted")
            setOpen(false)
            await logout()
        } catch (err) {
            toast.error(apiError(err, "Failed to delete account"))
        } finally {
            setDeleting(false)
        }
    }

    return (
        <>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-medium">Delete account</p>
                    <p className="text-xs text-muted-foreground">
                        Permanently disable your account. This cannot be undone.
                    </p>
                </div>
                <Button variant="destructive" onClick={() => setOpen(true)}>
                    Delete
                </Button>
            </div>

            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPassword("") }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete your account?</DialogTitle>
                        <DialogDescription>
                            This will disable your account and sign you out. Enter your password to confirm.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="delete-password">Password</Label>
                        <input
                            id="delete-password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete account"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default function SettingsPage() {
    return (
        <main className="mx-auto w-full max-w-xl px-4 pb-32 lg:max-w-2xl lg:pb-10 xl:max-w-3xl">
            {/* Header */}
            <div className="sticky top-14 z-30 -mx-4 mb-4 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
                <Link
                    href="/profile"
                    aria-label="Back"
                    className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <ArrowLeft className="size-5" />
                </Link>
                <h1 className="text-lg font-bold tracking-tight">Settings</h1>
            </div>

            <div className="space-y-6">
                {/* Edit profile */}
                <section className="rounded-2xl border border-border/60 bg-card p-5">
                    <div className="mb-5 flex items-center gap-2">
                        <UserRound className="size-4 text-muted-foreground" />
                        <div>
                            <h2 className="text-sm font-semibold">Edit profile</h2>
                            <p className="text-xs text-muted-foreground">Update your photo, name and bio</p>
                        </div>
                    </div>
                    <ProfileEditForm />
                </section>

                {/* Privacy */}
                <section className="rounded-2xl border border-border/60 bg-card p-5">
                    <div className="mb-5 flex items-center gap-2">
                        <Lock className="size-4 text-muted-foreground" />
                        <div>
                            <h2 className="text-sm font-semibold">Privacy</h2>
                            <p className="text-xs text-muted-foreground">Control who can see your profile</p>
                        </div>
                    </div>
                    <PrivacySection />
                </section>

                {/* Security */}
                <section className="rounded-2xl border border-border/60 bg-card p-5">
                    <div className="mb-5 flex items-center gap-2">
                        <KeyRound className="size-4 text-muted-foreground" />
                        <div>
                            <h2 className="text-sm font-semibold">Security</h2>
                            <p className="text-xs text-muted-foreground">Change your password</p>
                        </div>
                    </div>
                    <ChangePasswordSection />
                </section>

                {/* Appearance */}
                <section className="rounded-2xl border border-border/60 bg-card p-5">
                    <div className="mb-5 flex items-center gap-2">
                        <Palette className="size-4 text-muted-foreground" />
                        <div>
                            <h2 className="text-sm font-semibold">Appearance</h2>
                            <p className="text-xs text-muted-foreground">Customize how Parakgram looks</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label className="text-sm">Theme</Label>
                        <ThemeSwitcher />
                    </div>
                </section>

                {/* Danger zone */}
                <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                    <div className="mb-5 flex items-center gap-2">
                        <TriangleAlert className="size-4 text-destructive" />
                        <div>
                            <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
                            <p className="text-xs text-muted-foreground">Irreversible account actions</p>
                        </div>
                    </div>
                    <DangerZoneSection />
                </section>
            </div>
        </main>
    )
}
