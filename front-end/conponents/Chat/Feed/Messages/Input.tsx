import React, { useState } from "react";
import { Session } from "next-auth";
import { Box, Input } from "@chakra-ui/react";
import { toast } from "react-hot-toast";
import { useMutation } from "@apollo/client";
import MessageOperations from "../../../../graphql/operations/message";
import { SendMessageArguments } from "../../../../utils/types";
import { ObjectID } from "bson";

type Props = {
  session: Session;
  conversationId: string;
};

const MessageInput = ({ conversationId, session }: Props) => {
  const [messageBody, setMessageBody] = useState("");
  const [sendMessage] = useMutation<
    { sendMessage: boolean },
    SendMessageArguments
  >(MessageOperations.Mutation.sendMessage);

  // Handle sendMessage
  const onSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // call sendMessage mutation
      const { id: senderId } = session.user;
      const messageId = new ObjectID().toString();
      const newMessage: SendMessageArguments = {
        id: messageId,
        senderId,
        conversationId,
        body: messageBody,
      };

      const { data, errors } = await sendMessage({
        variables: {
          ...newMessage,
        },
      });

      if (!data?.sendMessage || errors) {
        throw new Error("failed to send message");
      }
    } catch (error: any) {
      console.log(error);
      toast.error(error?.message);
    }
  };

  return (
    <Box px={4} py={6} width="100%">
      <form onSubmit={onSendMessage}>
        <Input
          value={messageBody}
          size={"md"}
          placeholder="New message"
          resize={"none"}
          _focus={{
            boxShadow: "none",
            border: "1px solid",
            borderColor: "whiteAlpha.300",
          }}
          onChange={(e) => setMessageBody(e.target.value)}
        />
      </form>
    </Box>
  );
};

export default MessageInput;
