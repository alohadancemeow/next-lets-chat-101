import { Prisma } from "@prisma/client";
import { GraphQLError } from "graphql";
import { withFilter } from "graphql-subscriptions";
import { userIsConversationParticipant } from "../../../utils/functions";
import {
  ConversationDeletedSubscriptionPayload,
  ConversationPopulated,
  ConversationUpdatedSubscriptionPayload,
  GraphQLContext,
} from "../../../utils/types";

const resolvers = {
  Query: {
    conversations: async (
      _: any,
      __: any,
      contextvalue: GraphQLContext
    ): Promise<Array<ConversationPopulated>> => {
      const { session, prisma } = contextvalue;

      if (!session) {
        throw new GraphQLError("Not authorized");
      }

      const { id } = session.user;

      try {
        //  Find all conversations that user is part of
        const conversations = await prisma.conversation.findMany({
          // where: {
          //   participants: {
          //     some: {
          //       userId: {
          //         equals: userId,
          //       },
          //     },
          //   },
          // },
          include: conversationPopulated,
        });

        // Since above query does not work
        const myConversations = conversations.filter(
          (conversation) =>
            !!conversation.participants.find((p) => p.userId === id)
        );
        // console.log("myConversations", myConversations);

        return myConversations;
      } catch (error: any) {
        console.log("coversation error", error);
        throw new GraphQLError(error?.message);
      }
    },
  },
  Mutation: {
    createConversation: async (
      _: any,
      args: { participantIds: Array<string> },
      contextValue: GraphQLContext
    ): Promise<{ conversationId: string }> => {
      const { prisma, session, pubsub } = contextValue;
      const { participantIds } = args;

      if (!session?.user) {
        throw new GraphQLError("Not authorized");
      }

      const { id: userId } = session.user;

      // Create Conversation entity
      try {
        const conversation = await prisma.conversation.create({
          data: {
            participants: {
              createMany: {
                data: participantIds.map((id) => ({
                  userId: id,
                  hasSeenLatestMessage: id === userId,
                })),
              },
            },
          },
          include: conversationPopulated,
        });

        // emit a "CONVERSATION_CREATED" event using pubsub
        pubsub.publish("CONVERSATION_CREATED", {
          conversationCreated: conversation,
        });

        return { conversationId: conversation.id };
      } catch (error: any) {
        console.log("Error creating conversation", error);
        throw new GraphQLError("Error creating conversation");
      }
    },
    markConversationAsRead: async (
      _: any,
      args: { userId: string; conversationId: string },
      contextValue: GraphQLContext
    ): Promise<boolean> => {
      const { session, prisma } = contextValue;
      const { userId, conversationId } = args;

      if (!session.user) {
        throw new GraphQLError("Not authorized");
      }

      try {
        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            userId,
            conversationId,
          },
        });

        /**
         * Should always exists but being safe
         */
        if (!participant) {
          throw new GraphQLError("Participant entity not found");
        }

        await prisma.conversationParticipant.update({
          where: {
            id: participant.id,
          },
          data: {
            hasSeenLatestMessage: true,
          },
        });

        return true;
      } catch (error: any) {
        console.log("markConversationAsRead", error);
        throw new GraphQLError(error?.message);
      }
    },
    deleteConversation: async (
      _: any,
      args: { conversationId: string },
      contextValue: GraphQLContext
    ): Promise<boolean> => {
      const { session, prisma, pubsub } = contextValue;
      const { conversationId } = args;

      if (!session.user) {
        throw new GraphQLError("Notauthorized");
      }

      try {
        /**
         * Delete conversation and all related entites
         */

        const [deletedConversation] = await prisma.$transaction([
          prisma.conversation.delete({
            where: {
              id: conversationId,
            },
            include: conversationPopulated,
          }),
          prisma.conversationParticipant.deleteMany({
            where: {
              conversationId,
            },
          }),
          prisma.message.deleteMany({
            where: {
              conversationId,
            },
          }),
        ]);

        pubsub.publish("CONVERSATION_DELETED", {
          conversationDeleted: deletedConversation,
        });
      } catch (error: any) {
        console.log("deleteConversation error", error);
        throw new GraphQLError("Failed to delete conversation");
      }

      return true;
    },
  },
  Subscription: {
    conversationCreated: {
      subscribe: withFilter(
        (_: any, __: any, contextValue: GraphQLContext) => {
          const { pubsub } = contextValue;
          return pubsub.asyncIterator(["CONVERSATION_CREATED"]);
        },
        (
          payload: ConversationCreatedSubscriptionPayload,
          _,
          contextValue: GraphQLContext
        ) => {
          const { session } = contextValue;

          if (!session?.user) {
            throw new GraphQLError("Not authorized");
          }

          const { id: userId } = session.user;

          const {
            conversationCreated: { participants },
          } = payload;

          const userIsParticipant = userIsConversationParticipant(
            participants,
            userId
          );

          return userIsParticipant;
        }
      ),
    },
    conversationUpdated: {
      subscribe: withFilter(
        (_: any, __: any, contextValue: GraphQLContext) => {
          const { pubsub } = contextValue;
          return pubsub.asyncIterator(["CONVERSATION_UPDATED"]);
        },
        (
          payload: ConversationUpdatedSubscriptionPayload,
          _: any,
          contextValue: GraphQLContext
        ) => {
          const { session } = contextValue;

          if (!session.user) {
            throw new GraphQLError("Not authorized");
          }

          const { id: userId } = session.user;
          const {
            conversationUpdated: {
              conversation: { participants },
            },
          } = payload;

          const userIsParticipant = userIsConversationParticipant(
            participants,
            userId
          );

          return userIsParticipant;
        }
      ),
    },
    conversationDeleted: {
      subscribe: withFilter(
        (_: any, __: any, contextValue: GraphQLContext) => {
          const { pubsub } = contextValue;
          return pubsub.asyncIterator(["CONVERSATION_DELETED"]);
        },
        (
          payload: ConversationDeletedSubscriptionPayload,
          _: any,
          contextValue: GraphQLContext
        ) => {
          const { session } = contextValue;

          if (!session.user) {
            throw new GraphQLError("Not authorized");
          }

          const { id: userId } = session.user;
          const {
            conversationDeleted: { participants },
          } = payload;

          const userIsParticipant = userIsConversationParticipant(
            participants,
            userId
          );

          return userIsParticipant;
        }
      ),
    },
  },
};

export interface ConversationCreatedSubscriptionPayload {
  conversationCreated: ConversationPopulated;
}

// include statements
export const participantPopulated =
  Prisma.validator<Prisma.ConversationParticipantInclude>()({
    user: {
      select: {
        id: true,
        username: true,
        image: true,
      },
    },
  });

export const conversationPopulated =
  Prisma.validator<Prisma.ConversationInclude>()({
    participants: {
      include: participantPopulated,
    },
    latestMessage: {
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    },
  });

export default resolvers;
