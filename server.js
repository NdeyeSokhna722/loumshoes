// server.js - Backend Node.js pour LoumShoes
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', 'https://votre-domaine.com'],
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Dossier pour stocker les messages
const messagesDir = path.join(__dirname, 'messages');
if (!fs.existsSync(messagesDir)) {
    fs.mkdirSync(messagesDir, { recursive: true });
}

// Configuration du transporteur d'emails
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'thiernoloumsa@gmail.com',
        pass: process.env.EMAIL_PASS || 'votre-mot-de-passe'
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Vérification de la connexion au service d'email
transporter.verify((error, success) => {
    if (error) {
        console.error('Erreur de connexion au service email:', error);
    } else {
        console.log('Serveur email prêt à envoyer des messages');
    }
});

// Route de test
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Serveur LoumShoes en ligne',
        timestamp: new Date().toISOString()
    });
});

// Route pour recevoir les messages de contact
app.post('/api/contact', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, subject, message, newsletter } = req.body;

        // Validation des données
        if (!firstName || !lastName || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs obligatoires doivent être remplis.'
            });
        }

        // Validation de l'email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Adresse email invalide.'
            });
        }

        // Créer un objet message
        const messageData = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            firstName,
            lastName,
            email,
            phone: phone || 'Non fourni',
            subject,
            message,
            newsletter: newsletter || false,
            status: 'nouveau',
            read: false
        };

        // Sauvegarder le message localement
        const messageFile = path.join(messagesDir, `message_${messageData.id}.json`);
        fs.writeFileSync(messageFile, JSON.stringify(messageData, null, 2));

        // Envoyer un email de confirmation
        await sendConfirmationEmail(messageData);

        // Envoyer un email à l'administrateur
        await sendAdminNotification(messageData);

        console.log('Message reçu et sauvegardé:', messageData.id);

        res.status(200).json({
            success: true,
            message: 'Message envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.',
            data: {
                id: messageData.id,
                timestamp: messageData.timestamp
            }
        });

    } catch (error) {
        console.error('Erreur lors du traitement du message:', error);
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer plus tard.'
        });
    }
});

// Fonction pour envoyer un email de confirmation au client
async function sendConfirmationEmail(messageData) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'LoumShoes <noreply@loumshoes.com>',
            to: messageData.email,
            subject: 'Confirmation de réception de votre message - LoumShoes',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(to right, #3b82f6, #4f46e5); padding: 30px; text-align: center; color: white;">
                        <h1 style="margin: 0;">LoumShoes</h1>
                        <p style="margin: 10px 0 0 0;">Loum Business Corporations</p>
                    </div>
                    
                    <div style="padding: 30px; background-color: #f9fafb;">
                        <h2 style="color: #1f2937;">Bonjour ${messageData.firstName},</h2>
                        
                        <p style="color: #4b5563; line-height: 1.6;">
                            Nous avons bien reçu votre message et nous vous en remercions.
                            Notre équipe vous répondra dans les plus brefs délais.
                        </p>
                        
                        <div style="background-color: white; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Sujet :</strong> ${messageData.subject}</p>
                            <p style="margin: 5px 0;"><strong>Date :</strong> ${new Date(messageData.timestamp).toLocaleDateString('fr-FR')}</p>
                            <p style="margin: 5px 0;"><strong>Référence :</strong> ${messageData.id}</p>
                        </div>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                            <p style="color: #4b5563; font-size: 14px;">
                                <strong>Nos coordonnées :</strong><br>
                                📍 Dakar, Sénégal<br>
                                📞 +221 77 550 76 37<br>
                                ✉️ thiernoloumsa@gmail.com
                            </p>
                        </div>
                    </div>
                    
                    <div style="background-color: #1f2937; color: #9ca3af; text-align: center; padding: 20px; font-size: 12px;">
                        <p>© ${new Date().getFullYear()} LoumShoes - Loum Business Corporations. Tous droits réservés.</p>
                        <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Email de confirmation envoyé à:', messageData.email);
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email de confirmation:', error);
    }
}

// Fonction pour envoyer une notification à l'administrateur
async function sendAdminNotification(messageData) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'LoumShoes <noreply@loumshoes.com>',
            to: process.env.ADMIN_EMAIL || 'thiernoloumsa@gmail.com',
            subject: `📩 Nouveau message de contact - ${messageData.subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(to right, #ef4444, #dc2626); padding: 30px; text-align: center; color: white;">
                        <h1 style="margin: 0;">Nouveau Message - LoumShoes</h1>
                        <p style="margin: 10px 0 0 0;">Action requise</p>
                    </div>
                    
                    <div style="padding: 30px; background-color: #f9fafb;">
                        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                            <h3 style="color: #1f2937; margin-top: 0;">Informations du client</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Nom :</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">${messageData.firstName} ${messageData.lastName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Email :</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">${messageData.email}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Téléphone :</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">${messageData.phone}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Sujet :</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">${messageData.subject}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;"><strong>Date :</strong></td>
                                    <td style="padding: 8px 0;">${new Date(messageData.timestamp).toLocaleString('fr-FR')}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                            <h3 style="color: #1f2937; margin-top: 0;">Message</h3>
                            <p style="color: #4b5563; line-height: 1.6; white-space: pre-wrap;">${messageData.message}</p>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 30px;">
                            <a href="mailto:${messageData.email}" style="flex: 1; display: block; background-color: #3b82f6; color: white; text-align: center; padding: 12px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                Répondre par email
                            </a>
                            <a href="https://wa.me/221775507637?text=Bonjour, je réponds au message de ${messageData.firstName} ${messageData.lastName} (référence: ${messageData.id})" 
                               style="flex: 1; display: block; background-color: #10b981; color: white; text-align: center; padding: 12px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                Répondre par WhatsApp
                            </a>
                        </div>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                            <p style="color: #4b5563; font-size: 14px;">
                                <strong>Statut :</strong> ${messageData.newsletter ? 'Inscrit à la newsletter' : 'Non inscrit à la newsletter'}<br>
                                <strong>Référence :</strong> ${messageData.id}<br>
                                <strong>Fichier :</strong> message_${messageData.id}.json
                            </p>
                        </div>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Notification admin envoyée pour le message:', messageData.id);
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la notification admin:', error);
    }
}

// Route pour récupérer tous les messages (protégée)
app.get('/api/messages', (req, res) => {
    try {
        const files = fs.readdirSync(messagesDir);
        const messages = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const data = fs.readFileSync(path.join(messagesDir, file), 'utf8');
                return JSON.parse(data);
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            count: messages.length,
            messages
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des messages:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des messages'
        });
    }
});

// Route pour marquer un message comme lu
app.put('/api/messages/:id/read', (req, res) => {
    try {
        const messageId = req.params.id;
        const messageFile = path.join(messagesDir, `message_${messageId}.json`);
        
        if (fs.existsSync(messageFile)) {
            const messageData = JSON.parse(fs.readFileSync(messageFile, 'utf8'));
            messageData.read = true;
            messageData.readAt = new Date().toISOString();
            
            fs.writeFileSync(messageFile, JSON.stringify(messageData, null, 2));
            
            res.json({
                success: true,
                message: 'Message marqué comme lu'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            });
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du message:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du message'
        });
    }
});

// Route pour supprimer un message
app.delete('/api/messages/:id', (req, res) => {
    try {
        const messageId = req.params.id;
        const messageFile = path.join(messagesDir, `message_${messageId}.json`);
        
        if (fs.existsSync(messageFile)) {
            fs.unlinkSync(messageFile);
            res.json({
                success: true,
                message: 'Message supprimé avec succès'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            });
        }
    } catch (error) {
        console.error('Erreur lors de la suppression du message:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du message'
        });
    }
});

// Route pour les statistiques
app.get('/api/stats', (req, res) => {
    try {
        const files = fs.readdirSync(messagesDir);
        const messages = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const data = fs.readFileSync(path.join(messagesDir, file), 'utf8');
                return JSON.parse(data);
            });

        const stats = {
            total: messages.length,
            read: messages.filter(m => m.read).length,
            unread: messages.filter(m => !m.read).length,
            bySubject: {},
            byMonth: {},
            newsletterSubscribers: messages.filter(m => m.newsletter).length
        };

        // Statistiques par sujet
        messages.forEach(message => {
            stats.bySubject[message.subject] = (stats.bySubject[message.subject] || 0) + 1;
        });

        // Statistiques par mois
        messages.forEach(message => {
            const date = new Date(message.timestamp);
            const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
            stats.byMonth[monthYear] = (stats.byMonth[monthYear] || 0) + 1;
        });

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Erreur lors du calcul des statistiques:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du calcul des statistiques'
        });
    }
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée'
    });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
    console.error('Erreur globale:', err);
    res.status(500).json({
        success: false,
        message: 'Une erreur interne est survenue',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur LoumShoes démarré sur le port ${PORT}`);
    console.log(`📧 Service email: ${process.env.EMAIL_USER || 'Configuration manquante'}`);
    console.log(`📁 Messages stockés dans: ${messagesDir}`);
});