import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/LoginPage.css";

// Icons
import { UserIcon, LockIcon, PhoneIcon, MailIcon, UsersIcon, BookIcon, EyeIcon, EyeOffIcon, KeyIcon } from "../components/Icons";

const academicPrograms = {
  "School of Engineering and Technology": ["B.Tech - CSE", "B.Tech - AI", "B.Tech - Civil", "B.Tech - Mech", "BCA", "MCA"],
  "School of Management Studies": ["BBA", "MBA", "B.Com"],
  "School of Law": ["BA LL.B", "LL.B", "LL.M"],
  "School of Pharmaceutical Sciences": ["B.Pharm", "D.Pharm"],
  "School of Design": ["B.Des", "B.Sc Animation"],
  "School of Health Sciences": ["BPT", "B.Sc MLT"]
};

function RegisterPage() {
  const [formData, setFormData] = useState({ id: "", role: "", studentType: "current", fullName: "", email: "", phone: "", password: "", program: "", });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  // 🔐 OTP State
  const [otpPhone, setOtpPhone] = useState("");
  const [otpEmail, setOtpEmail] = useState("");

  const [step, setStep] = useState(1);
  const [msg, setMsg] = useState("");
  const [statusType, setStatusType] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Keep uppercase but allow numbers freely
    const processedValue = name === "id" ? value.toUpperCase() : value;
    setFormData({ ...formData, [name]: processedValue });
  };

  const getPasswordStrength = (password) => {
    const reqs = {
      length: password?.length >= 8,
      uppercase: /[A-Z]/.test(password || ""),
      lowercase: /[a-z]/.test(password || ""),
      number: /[0-9]/.test(password || ""),
      special: /[^A-Za-z0-9]/.test(password || "")
    };

    let score = 0;
    if (!password) return { text: "", color: "transparent", percent: 0, level: 0, reqs };
    
    if (reqs.length) score += 1;
    if (reqs.uppercase) score += 1;
    if (reqs.lowercase) score += 1;
    if (reqs.number) score += 1;
    if (reqs.special) score += 1;

    let result = { text: "", color: "transparent", percent: 0, level: 0, reqs };

    if (!reqs.length) {
      result = { text: "Too short (Min 8 chars)", color: "#ef4444", percent: 25, level: 1, reqs };
    } else if (score <= 2) {
      result = { text: "Weak", color: "#f97316", percent: 50, level: 2, reqs };
    } else if (score === 3 || score === 4) {
      result = { text: "Good", color: "#eab308", percent: 75, level: 3, reqs };
    } else if (score === 5) {
      result = { text: "Strong", color: "#22c55e", percent: 100, level: 4, reqs };
    }
    
    return result;
  };

  const strength = getPasswordStrength(formData.password);

  // STEP 1: Request OTP
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    // ✅ Password Match & Length Validation
    if (formData.password.length < 8) {
      setMsg("Password must be at least 8 characters long!");
      setStatusType("error");
      return;
    }

    if (formData.password !== confirmPassword) {
      setMsg("Passwords do not match!");
      setStatusType("error");
      return;
    }

    setMsg("Validating details & Sending Verification Codes...");
    setStatusType("info");
    setLoading(true);

    try {
      // 🔥 Update Endpoint
      const res = await fetch("http://localhost:5000/api/auth/register-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setStep(2);
      setMsg("Verification codes sent to Phone and Email!");
      setStatusType("success");
    } catch (err) {
      setMsg(err.message || "Failed to send OTPs.");
      setStatusType("error");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setMsg("Finalizing registration...");
    setStatusType("info");
    setLoading(true);

    try {
      // 🔥 Update Endpoint & Payload
      const res = await fetch("http://localhost:5000/api/auth/verify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          otpPhone: otpPhone,
          otpEmail: otpEmail,
          formData: formData
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setMsg("Registration successful! Redirecting to Login...");
      setStatusType("success");
      setTimeout(() => window.location.href = "/", 2000);
    } catch (err) {
      setMsg(err.message || "Invalid OTPs.");
      setStatusType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-brand-section">
        <div className="brand-content">
          <h1>{step === 1 ? "Join the Portal" : "Account Verification"}</h1>
          <p>{step === 1 ? "Create your account to access university services." : "We've sent a code to your Phone and Email to ensure account security."}</p>
          <div className="brand-footer">© 2025 University Administration</div>
        </div>
      </div>

      <div className="login-form-section">
        <div className="form-wrapper animated-form">
          <div className="form-header">
            <h2>{step === 1 ? "Register" : "Verify It's You"}</h2>
            <p>{step === 1 ? "Enter details exactly as per University Records." : `Check your phone: ${formData.phone}`}</p>
          </div>

          {msg && <div className={`alert-box ${statusType}`}>{msg}</div>}

          {step === 1 ? (
            /* REGISTRATION FORM */
            <form onSubmit={handleRegisterSubmit}>
              <div className="two-col-row">
                <div className="input-group">
                  <label>Role</label>
                  <div className="input-wrapper role-field">
                    <span className="icon"><UsersIcon /></span>
                    <select name="role" value={formData.role} onChange={handleChange} required>
                      <option value="">Select Role</option>
                      <option value="student">Student</option>
                      <option value="staff">Staff</option>
                      {/* 🚫 Admin Role Removed */}
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label>University ID</label>
                  <div className="input-wrapper id-field">
                    <span className="icon"><UserIcon /></span>
                    <input name="id" placeholder="e.g. 72212871" value={formData.id} onChange={handleChange} required />
                  </div>
                </div>
              </div>

              {formData.role === 'student' && (
                <div className="input-group">
                  <label>Student Status</label>
                  <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <label style={{
                      flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontWeight: '500', transition: 'all 0.2s',
                      border: formData.studentType === 'current' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      backgroundColor: formData.studentType === 'current' ? '#eff6ff' : 'white',
                      color: formData.studentType === 'current' ? '#2563eb' : '#64748b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}>
                      <input type="radio" name="studentType" value="current" checked={formData.studentType === 'current'} onChange={handleChange} style={{ accentColor: '#2563eb' }} />
                      Current Student
                    </label>
                    <label style={{
                      flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontWeight: '500', transition: 'all 0.2s',
                      border: formData.studentType === 'alumni' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      backgroundColor: formData.studentType === 'alumni' ? '#eff6ff' : 'white',
                      color: formData.studentType === 'alumni' ? '#2563eb' : '#64748b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}>
                      <input type="radio" name="studentType" value="alumni" checked={formData.studentType === 'alumni'} onChange={handleChange} style={{ accentColor: '#2563eb' }} />
                      Alumni
                    </label>
                  </div>
                </div>
              )}

              <div className="two-col-row">
                <div className="input-group">
                  <label>Full Name</label>
                  <div className="input-wrapper">
                    <span className="icon"><UserIcon /></span>
                    <input name="fullName" placeholder="Full Name" value={formData.fullName} onChange={handleChange} required />
                  </div>
                </div>

                <div className="input-group">
                  <label>Phone</label>
                  <div className="input-wrapper phone-field">
                    <span className="icon"><PhoneIcon /></span>
                    <input name="phone" type="tel" placeholder="9876543210" value={formData.phone} onChange={handleChange} pattern="[0-9]{10}" required />
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label>Email</label>
                <div className="input-wrapper email-field">
                  <span className="icon"><MailIcon /></span>
                  <input
                    name="email"
                    type="email"
                    placeholder={"e.g. name@univ.com or personal@mail.com"}
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="field-hint info"><em>We will verify your Phone number.</em></div>
              </div>

              <div className="two-col-row">
                <div className="input-group">
                  <label>Password</label>
                  <div className="input-wrapper password">
                    <span className="icon"><LockIcon /></span>
                    <input name="password" type={showPassword ? "text" : "password"} placeholder="Create Password" value={formData.password} onChange={handleChange} required />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="password-toggle"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {formData.password && (
                    <div style={{ marginTop: '12px', padding: '0 4px', animation: 'fadeIn 0.3s ease-out' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px', color: strength.color, fontWeight: '600', transition: 'color 0.3s ease' }}>
                        <span style={{ color: '#64748b' }}>Password Strength</span>
                        <span>{strength.text}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', height: '6px' }}>
                        {[1, 2, 3, 4].map((index) => (
                          <div key={index} style={{
                            flex: 1,
                            backgroundColor: index <= strength.level ? strength.color : '#e2e8f0',
                            borderRadius: '3px',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: index <= strength.level ? `0 0 8px ${strength.color}40` : 'none',
                            transform: index <= strength.level ? 'scaleY(1)' : 'scaleY(0.8)',
                            opacity: index <= strength.level ? 1 : 0.5
                          }}></div>
                        ))}
                      </div>
                      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
                        {[
                          { label: 'Min 8 chars', met: strength.reqs?.length },
                          { label: 'Uppercase', met: strength.reqs?.uppercase },
                          { label: 'Lowercase', met: strength.reqs?.lowercase },
                          { label: 'Number', met: strength.reqs?.number },
                          { label: 'Special Char', met: strength.reqs?.special }
                        ].map((req, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: req.met ? '#16a34a' : '#94a3b8', transition: 'color 0.3s' }}>
                            <div style={{ 
                              width: '12px', height: '12px', borderRadius: '50%', 
                              backgroundColor: req.met ? '#16a34a' : 'transparent',
                              border: `1.5px solid ${req.met ? '#16a34a' : '#cbd5e1'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.3s'
                            }}>
                              {req.met && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                            </div>
                            <span style={{ fontWeight: req.met ? '500' : '400' }}>{req.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label>Confirm Password</label>
                <div className="input-wrapper password" >
                  <span className="icon"><LockIcon /></span>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="password-toggle"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {formData.role === 'student' && (
                <div className="input-group">
                  <label>Program & Domain</label>
                  <div className="input-wrapper program-field">
                    <span className="icon"><BookIcon /></span>
                    <select name="program" value={formData.program} onChange={handleChange} required>
                      <option value="">Select Your Program</option>
                      {Object.entries(academicPrograms).map(([dept, courses]) => (
                        <optgroup key={dept} label={dept}>
                          {courses.map(course => <option key={course} value={course}>{course}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Verify & Register"}
              </button>
            </form>
          ) : (
            /* OTP FORM */
            <form onSubmit={handleVerifyOtp} className="animated-form">

              {/* Phone OTP */}
              <div className="input-group">
                <label>SMS Code (Sent to {formData.phone})</label>
                <div className="input-wrapper otp-field">
                  <span className="icon"><PhoneIcon /></span>
                  <input
                    style={{ letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }}
                    placeholder="SMS Code"
                    maxLength="6"
                    value={otpPhone}
                    onChange={(e) => setOtpPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Email OTP */}
              <div className="input-group">
                <label>Email Code (Sent to {formData.email})</label>
                <div className="input-wrapper otp-field">
                  <span className="icon"><MailIcon /></span>
                  <input
                    style={{ letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }}
                    placeholder="Email Code"
                    maxLength="6"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify & Finish"}
              </button>
              <center>
                <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', textDecoration: 'underline', marginTop: '10px', fontSize: '14px' }}>
                  Back to edit details
                </button>
              </center>
            </form>
          )}

          <div className="form-footer">
            <p>Already have an account? <Link to="/">Login here</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;